import { Request, Response } from 'express';
import { programInputSchema, programUpdateSchema } from '../validators/programSchema';
import {
  assertValidDomain,
  assertValidHealthCheckPath,
  assertValidHost,
  assertValidPort,
  domainToConfigFileName,
  ValidationError,
} from '../utils/validation';
import { programRepository } from '../repositories/programRepository';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';
import { toApacheSettingsInput, toBackupPaths } from '../utils/settingsMapper';
import { prisma } from '../config/prisma';
import { recordApplyBackup } from '../utils/recordApplyBackup';

async function checkPortWarnings(
  targetHost: string,
  targetPort: number,
  isSystemPort: boolean,
  excludeId?: string
) {
  const warnings: string[] = [];
  if (isSystemPort) {
    warnings.push(`포트 ${targetPort}은(는) 시스템 포트입니다. 의도한 설정인지 확인하세요.`);
  }
  const sameHostPort = await programRepository.findByHostAndPort(targetHost, targetPort, excludeId);
  if (sameHostPort.length > 0) {
    warnings.push(
      `동일한 내부 IP(${targetHost})와 포트(${targetPort})를 사용하는 프로그램이 이미 있습니다: ${sameHostPort
        .map((p) => p.name)
        .join(', ')}`
    );
  } else {
    const samePort = await programRepository.findByPort(targetPort, excludeId);
    if (samePort.length > 0) {
      warnings.push(
        `포트 ${targetPort}을(를) 사용하는 다른 프로그램이 있습니다: ${samePort
          .map((p) => p.name)
          .join(', ')} (다른 내부 IP이면 문제가 없을 수 있습니다.)`
      );
    }
  }
  return warnings;
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const programs = await programRepository.list();
  res.json(programs);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const program = await programRepository.findById(req.params.id);
  if (!program) {
    res.status(404).json({ error: 'NOT_FOUND', message: '프로그램을 찾을 수 없습니다.' });
    return;
  }
  res.json(program);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = programInputSchema.parse(req.body);

  const domain = assertValidDomain(input.domain);
  const targetHost = assertValidHost(input.targetHost);
  const { port, isSystemPort } = assertValidPort(input.targetPort);
  const healthCheckPath = assertValidHealthCheckPath(input.healthCheckPath);
  const configFileName = domainToConfigFileName(domain);

  const existing = await programRepository.findByDomain(domain);
  if (existing) {
    throw new ValidationError('이미 등록된 도메인입니다.');
  }

  const warnings = await checkPortWarnings(targetHost, port, isSystemPort);

  const program = await programRepository.create({
    name: input.name,
    description: input.description || null,
    domain,
    targetProtocol: input.targetProtocol,
    targetHost,
    targetPort: port,
    healthCheckPath,
    websocketEnabled: input.websocketEnabled,
    sslEnabled: input.sslEnabled,
    enabled: input.enabled,
    configFileName,
    configStatus: 'NOT_APPLIED',
    healthStatus: 'UNKNOWN',
  });

  await services.auditService.log({
    action: 'PROGRAM_CREATE',
    actorUsername: req.session.username,
    targetType: 'Program',
    targetId: program.id,
    result: 'SUCCESS',
    detail: { domain, targetHost, targetPort: port },
  });

  res.status(201).json({ program, warnings });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const existingProgram = await programRepository.findById(req.params.id);
  if (!existingProgram) {
    res.status(404).json({ error: 'NOT_FOUND', message: '프로그램을 찾을 수 없습니다.' });
    return;
  }

  const input = programUpdateSchema.parse(req.body);
  const domain = input.domain !== undefined ? assertValidDomain(input.domain) : existingProgram.domain;
  const targetHost =
    input.targetHost !== undefined ? assertValidHost(input.targetHost) : existingProgram.targetHost;
  const portCheck =
    input.targetPort !== undefined ? assertValidPort(input.targetPort) : { port: existingProgram.targetPort, isSystemPort: false };
  const healthCheckPath =
    input.healthCheckPath !== undefined
      ? assertValidHealthCheckPath(input.healthCheckPath)
      : existingProgram.healthCheckPath ?? '/';

  if (domain !== existingProgram.domain) {
    const domainOwner = await programRepository.findByDomain(domain);
    if (domainOwner && domainOwner.id !== existingProgram.id) {
      throw new ValidationError('이미 등록된 도메인입니다.');
    }
  }

  const warnings = await checkPortWarnings(
    targetHost,
    portCheck.port,
    portCheck.isSystemPort,
    existingProgram.id
  );

  const domainChanged = domain !== existingProgram.domain;
  let configFileName = existingProgram.configFileName;
  let configStatus = existingProgram.configStatus;

  if (domainChanged) {
    configFileName = domainToConfigFileName(domain);
    if (existingProgram.configStatus === 'APPLIED' || existingProgram.configStatus === 'PENDING') {
      const settings = await services.settingsService.get();
      const removeOutcome = await services.apacheApplyService.removeProgramConfig(
        existingProgram.configFileName,
        toBackupPaths(settings),
        existingProgram.domain
      );
      await recordApplyBackup(
        toBackupPaths(settings).backupRootPath,
        removeOutcome,
        req.session.username,
        `program-domain-change:${existingProgram.domain}`
      );
      await services.auditService.log({
        action: 'PROGRAM_DOMAIN_CHANGE_REMOVE_OLD_CONFIG',
        actorUsername: req.session.username,
        targetType: 'Program',
        targetId: existingProgram.id,
        result: removeOutcome.success ? 'SUCCESS' : 'FAILURE',
        detail: { oldDomain: existingProgram.domain, newDomain: domain, message: removeOutcome.message },
      });
    }
    configStatus = 'NOT_APPLIED';
  }

  const updated = await programRepository.update(existingProgram.id, {
    name: input.name ?? existingProgram.name,
    description: input.description !== undefined ? input.description || null : existingProgram.description,
    domain,
    targetProtocol: input.targetProtocol ?? existingProgram.targetProtocol,
    targetHost,
    targetPort: portCheck.port,
    healthCheckPath,
    websocketEnabled: input.websocketEnabled ?? existingProgram.websocketEnabled,
    sslEnabled: input.sslEnabled ?? existingProgram.sslEnabled,
    enabled: input.enabled ?? existingProgram.enabled,
    configFileName,
    configStatus,
  });

  await services.auditService.log({
    action: 'PROGRAM_UPDATE',
    actorUsername: req.session.username,
    targetType: 'Program',
    targetId: updated.id,
    result: 'SUCCESS',
    detail: { domainChanged },
  });

  res.json({ program: updated, warnings });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const program = await programRepository.findById(req.params.id);
  if (!program) {
    res.status(404).json({ error: 'NOT_FOUND', message: '프로그램을 찾을 수 없습니다.' });
    return;
  }

  if (program.configStatus === 'APPLIED' || program.configStatus === 'PENDING') {
    const settings = await services.settingsService.get();
    const removeOutcome = await services.apacheApplyService.removeProgramConfig(
      program.configFileName,
      toBackupPaths(settings),
      program.domain
    );
    await recordApplyBackup(
      toBackupPaths(settings).backupRootPath,
      removeOutcome,
      req.session.username,
      `program-delete:${program.domain}`
    );
    await services.auditService.log({
      action: 'PROGRAM_DELETE_REMOVE_CONFIG',
      actorUsername: req.session.username,
      targetType: 'Program',
      targetId: program.id,
      result: removeOutcome.success ? 'SUCCESS' : 'FAILURE',
      detail: { message: removeOutcome.message },
    });
    if (!removeOutcome.success) {
      res.status(500).json({
        error: 'APACHE_APPLY_FAILED',
        message: `Apache 설정 제거에 실패하여 프로그램을 삭제하지 않았습니다: ${removeOutcome.message}`,
      });
      return;
    }
  }

  await programRepository.delete(program.id);
  await services.auditService.log({
    action: 'PROGRAM_DELETE',
    actorUsername: req.session.username,
    targetType: 'Program',
    targetId: program.id,
    result: 'SUCCESS',
  });
  res.json({ ok: true });
});

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const program = await programRepository.findById(req.params.id);
  if (!program) {
    res.status(404).json({ error: 'NOT_FOUND', message: '프로그램을 찾을 수 없습니다.' });
    return;
  }

  const settings = await services.settingsService.get();
  const moduleCheck = await services.apacheModuleInspector.check();
  const generated = services.apacheConfigGenerator.generate(
    {
      domain: program.domain,
      targetProtocol: program.targetProtocol as 'http' | 'https',
      targetHost: program.targetHost,
      targetPort: program.targetPort,
      websocketEnabled: program.websocketEnabled,
      sslEnabled: program.sslEnabled,
    },
    toApacheSettingsInput(settings),
    settings.managedSitesPath
  );

  const precheckIssues: string[] = [];
  if (moduleCheck.missingRequired.length > 0) {
    precheckIssues.push(`다음 필수 Apache 모듈이 비활성 상태입니다: ${moduleCheck.missingRequired.join(', ')}`);
  }
  if (program.websocketEnabled && !moduleCheck.websocketSupported) {
    precheckIssues.push('WebSocket 사용이 설정되어 있지만 mod_proxy_wstunnel 모듈이 비활성 상태입니다.');
  }

  res.json({
    fileName: generated.fileName,
    filePath: generated.filePath,
    content: generated.content,
    moduleCheck,
    precheckIssues,
  });
});

export const apply = asyncHandler(async (req: Request, res: Response) => {
  const program = await programRepository.findById(req.params.id);
  if (!program) {
    res.status(404).json({ error: 'NOT_FOUND', message: '프로그램을 찾을 수 없습니다.' });
    return;
  }

  const settings = await services.settingsService.get();
  const moduleCheck = await services.apacheModuleInspector.check();

  if (moduleCheck.missingRequired.length > 0) {
    res.status(409).json({
      error: 'MODULE_MISSING',
      message: `다음 필수 Apache 모듈이 비활성 상태여서 적용할 수 없습니다: ${moduleCheck.missingRequired.join(', ')}`,
      moduleCheck,
    });
    return;
  }
  if (program.websocketEnabled && !moduleCheck.websocketSupported) {
    res.status(409).json({
      error: 'WEBSOCKET_MODULE_MISSING',
      message: 'WebSocket 사용이 설정되어 있지만 mod_proxy_wstunnel 모듈이 비활성 상태입니다.',
      moduleCheck,
    });
    return;
  }

  const action = program.configStatus === 'APPLIED' ? 'UPDATE' : 'CREATE';
  const outcome = await services.apacheApplyService.applyProgramConfig(
    {
      domain: program.domain,
      targetProtocol: program.targetProtocol as 'http' | 'https',
      targetHost: program.targetHost,
      targetPort: program.targetPort,
      websocketEnabled: program.websocketEnabled,
      sslEnabled: program.sslEnabled,
    },
    toApacheSettingsInput(settings),
    toBackupPaths(settings),
    req.session.username ?? 'unknown',
    action
  );

  const newConfigStatus = outcome.success ? 'APPLIED' : outcome.rolledBack ? 'ROLLED_BACK' : 'FAILED';
  await programRepository.update(program.id, { configStatus: newConfigStatus });

  await recordApplyBackup(
    toBackupPaths(settings).backupRootPath,
    outcome,
    req.session.username,
    `program-${action.toLowerCase()}:${program.domain}`
  );

  if (outcome.content) {
    await prisma.apacheConfigRevision.create({
      data: {
        programId: program.id,
        fileName: outcome.fileName,
        action: outcome.action,
        content: outcome.content,
        createdBy: req.session.username ?? 'unknown',
      },
    });
  }

  await services.auditService.log({
    action: outcome.success ? 'APACHE_APPLY_SUCCESS' : 'APACHE_APPLY_FAILURE',
    actorUsername: req.session.username,
    targetType: 'Program',
    targetId: program.id,
    result: outcome.success ? 'SUCCESS' : 'FAILURE',
    detail: { message: outcome.message, rolledBack: outcome.rolledBack },
  });

  res.status(outcome.success ? 200 : 409).json({ outcome, configStatus: newConfigStatus });
});

export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  const program = await programRepository.findById(req.params.id);
  if (!program) {
    res.status(404).json({ error: 'NOT_FOUND', message: '프로그램을 찾을 수 없습니다.' });
    return;
  }

  const settings = await services.settingsService.get();
  const outcome = await services.healthCheckService.check(
    {
      targetProtocol: program.targetProtocol as 'http' | 'https',
      targetHost: program.targetHost,
      targetPort: program.targetPort,
      healthCheckPath: program.healthCheckPath,
    },
    settings.defaultHealthCheckTimeoutMs
  );

  await prisma.programHealthCheck.create({
    data: {
      programId: program.id,
      status: outcome.status,
      tcpOk: outcome.tcpOk,
      httpOk: outcome.httpOk,
      healthOk: outcome.healthOk,
      statusCode: outcome.statusCode,
      responseTimeMs: outcome.responseTimeMs,
      errorMessage: outcome.errorMessage,
    },
  });

  await programRepository.update(program.id, {
    healthStatus: outcome.status,
    lastHealthCheckedAt: new Date(),
  });

  await services.auditService.log({
    action: 'PROGRAM_TEST_CONNECTION',
    actorUsername: req.session.username,
    targetType: 'Program',
    targetId: program.id,
    result: outcome.status === 'UNREACHABLE' ? 'FAILURE' : 'SUCCESS',
    detail: { status: outcome.status },
  });

  res.json(outcome);
});

export const setEnabled = (enabled: boolean) =>
  asyncHandler(async (req: Request, res: Response) => {
    const program = await programRepository.findById(req.params.id);
    if (!program) {
      res.status(404).json({ error: 'NOT_FOUND', message: '프로그램을 찾을 수 없습니다.' });
      return;
    }

    const settings = await services.settingsService.get();

    if (!enabled) {
      const outcome = await services.apacheApplyService.removeProgramConfig(
        program.configFileName,
        toBackupPaths(settings),
        program.domain
      );
      await recordApplyBackup(
        toBackupPaths(settings).backupRootPath,
        outcome,
        req.session.username,
        `program-disable:${program.domain}`
      );
      await programRepository.update(program.id, {
        enabled: false,
        configStatus: outcome.success ? 'NOT_APPLIED' : program.configStatus,
      });
      await services.auditService.log({
        action: 'PROGRAM_DISABLE',
        actorUsername: req.session.username,
        targetType: 'Program',
        targetId: program.id,
        result: outcome.success ? 'SUCCESS' : 'FAILURE',
        detail: { message: outcome.message },
      });
      res.json({ ok: outcome.success, outcome });
      return;
    }

    await programRepository.update(program.id, { enabled: true });
    await services.auditService.log({
      action: 'PROGRAM_ENABLE',
      actorUsername: req.session.username,
      targetType: 'Program',
      targetId: program.id,
      result: 'SUCCESS',
      detail: { note: '활성화되었습니다. 설정을 적용하려면 적용 버튼을 눌러주세요.' },
    });
    res.json({ ok: true, note: '프로그램이 활성화되었습니다. 변경사항을 반영하려면 설정을 적용하세요.' });
  });

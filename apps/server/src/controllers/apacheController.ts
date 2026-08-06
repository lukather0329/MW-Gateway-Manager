import { Request, Response } from 'express';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';
import { toSetupCheckPaths } from '../utils/settingsMapper';

export const status = asyncHandler(async (_req: Request, res: Response) => {
  const [processStatus, version, moduleCheck] = await Promise.all([
    services.apacheRunner.getStatus(),
    services.apacheRunner.getVersion(),
    services.apacheModuleInspector.check(),
  ]);
  res.json({ processStatus, version: version.stdout || version.stderr, moduleCheck });
});

export const testConfig = asyncHandler(async (_req: Request, res: Response) => {
  const result = await services.apacheConfigValidator.test();
  res.json(result);
});

export const graceful = asyncHandler(async (req: Request, res: Response) => {
  const result = await services.apacheRunner.gracefulReload();
  await services.auditService.log({
    action: 'APACHE_MANUAL_GRACEFUL',
    actorUsername: req.session.username,
    result: result.code === 0 ? 'SUCCESS' : 'FAILURE',
    detail: { code: result.code },
  });
  res.json(result);
});

export const modules = asyncHandler(async (_req: Request, res: Response) => {
  const result = await services.apacheModuleInspector.check();
  res.json(result);
});

export const setupCheck = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await services.settingsService.get();
  const result = await services.apacheSetupWizardService.check(toSetupCheckPaths(settings));
  res.json(result);
});

export const setupApplyIncludeOptional = asyncHandler(async (req: Request, res: Response) => {
  const settings = await services.settingsService.get();
  const result = await services.apacheSetupWizardService.applyIncludeOptional(
    toSetupCheckPaths(settings)
  );
  if (result.applied) {
    await services.settingsService.markIncludeOptionalApplied();
  }
  await services.auditService.log({
    action: 'APACHE_SETUP_INCLUDE_OPTIONAL',
    actorUsername: req.session.username,
    result: 'SUCCESS',
    detail: result,
  });
  res.json(result);
});

import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { SystemSettingParsed } from '../../validators/settingsSchema';

/**
 * SystemSetting is a singleton row (id=1). On first read, if it doesn't
 * exist yet, it is created from the .env defaults documented in
 * docs/ENVIRONMENT_ANALYSIS.md — these are assumptions about the real
 * server layout and must be reviewed/edited by an admin via the Settings
 * screen before relying on them.
 */
export class SettingsService {
  async get() {
    const existing = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    if (existing) return existing;

    return prisma.systemSetting.create({
      data: {
        id: 1,
        apacheRootPath: env.apacheRootPath,
        apacheExecutablePath: env.apacheExecutablePath,
        apacheVhostsPath: env.apacheVhostsPath,
        managedSitesPath: env.apacheManagedSitesPath,
        backupPath: env.apacheBackupPath,
        sslCertificatePath: env.sslCertificatePath,
        sslCertificateKeyPath: env.sslCertificateKeyPath,
        defaultDomainSuffix: env.defaultDomainSuffix,
        defaultHealthCheckTimeoutMs: env.defaultHealthCheckTimeoutMs,
        includeOptionalApplied: false,
      },
    });
  }

  async update(input: SystemSettingParsed) {
    return prisma.systemSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...input, includeOptionalApplied: false },
      update: { ...input },
    });
  }

  async markIncludeOptionalApplied() {
    return prisma.systemSetting.update({
      where: { id: 1 },
      data: { includeOptionalApplied: true },
    });
  }
}

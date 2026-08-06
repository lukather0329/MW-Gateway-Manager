import { SystemSetting } from '@prisma/client';
import { BackupPaths } from '../services/apache/ApacheBackupService';
import { ApacheSettingsInput } from '../services/apache/ApacheConfigGenerator';
import { SetupCheckPaths } from '../services/apache/ApacheSetupWizardService';

export function toBackupPaths(settings: SystemSetting): BackupPaths {
  return {
    backupRootPath: settings.backupPath,
    vhostsFilePath: settings.apacheVhostsPath,
    managedSitesPath: settings.managedSitesPath,
  };
}

export function toApacheSettingsInput(settings: SystemSetting): ApacheSettingsInput {
  return {
    sslCertificatePath: settings.sslCertificatePath,
    sslCertificateKeyPath: settings.sslCertificateKeyPath,
  };
}

export function toSetupCheckPaths(settings: SystemSetting): SetupCheckPaths {
  return {
    apacheRootPath: settings.apacheRootPath,
    apacheExecutablePath: settings.apacheExecutablePath,
    apacheVhostsPath: settings.apacheVhostsPath,
    managedSitesPath: settings.managedSitesPath,
    backupPath: settings.backupPath,
    sslCertificatePath: settings.sslCertificatePath,
    sslCertificateKeyPath: settings.sslCertificateKeyPath,
  };
}

import { createApacheCommandRunner } from './apache/apacheRunnerFactory';
import { ApacheConfigGenerator } from './apache/ApacheConfigGenerator';
import { ApacheConfigValidator } from './apache/ApacheConfigValidator';
import { ApacheBackupService } from './apache/ApacheBackupService';
import { ApacheRollbackService } from './apache/ApacheRollbackService';
import { ApacheApplyService } from './apache/ApacheApplyService';
import { ApacheModuleInspector } from './apache/ApacheModuleInspector';
import { ApacheSetupWizardService } from './apache/ApacheSetupWizardService';
import { HealthCheckService } from './health-check/HealthCheckService';
import { HealthCheckScheduler } from './health-check/HealthCheckScheduler';
import { AuditService } from './audit/AuditService';
import { AuthService } from './auth/AuthService';
import { SettingsService } from './settings/SettingsService';
import { env } from '../config/env';

// Simple hand-wired composition root — no DI framework, kept intentionally
// small for this MVP's scale (spec section 3.2: avoid over-engineering).
const apacheRunner = createApacheCommandRunner();
const apacheConfigGenerator = new ApacheConfigGenerator();
const apacheConfigValidator = new ApacheConfigValidator(apacheRunner);
const apacheBackupService = new ApacheBackupService();
const apacheRollbackService = new ApacheRollbackService(
  apacheBackupService,
  apacheConfigValidator,
  apacheRunner
);
const apacheApplyService = new ApacheApplyService(
  apacheConfigGenerator,
  apacheConfigValidator,
  apacheBackupService,
  apacheRollbackService,
  apacheRunner
);
const apacheModuleInspector = new ApacheModuleInspector(apacheRunner);
const apacheSetupWizardService = new ApacheSetupWizardService(apacheRunner);
const healthCheckService = new HealthCheckService();
const auditService = new AuditService();
const authService = new AuthService();
const settingsService = new SettingsService();
const healthCheckScheduler = new HealthCheckScheduler(
  healthCheckService,
  settingsService,
  auditService,
  env.healthCheckIntervalMs
);

export const services = {
  apacheRunner,
  apacheConfigGenerator,
  apacheConfigValidator,
  apacheBackupService,
  apacheRollbackService,
  apacheApplyService,
  apacheModuleInspector,
  apacheSetupWizardService,
  healthCheckService,
  healthCheckScheduler,
  auditService,
  authService,
  settingsService,
};

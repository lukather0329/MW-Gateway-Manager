export type TargetProtocol = 'http' | 'https';

export type ConfigStatus =
  | 'NOT_APPLIED'
  | 'PENDING'
  | 'APPLIED'
  | 'FAILED'
  | 'ROLLED_BACK';

export type HealthStatus =
  | 'UNKNOWN'
  | 'CHECKING'
  | 'UNREACHABLE'
  | 'TCP_OK'
  | 'HTTP_OK'
  | 'HEALTHY'
  | 'HEALTH_CHECK_FAILED';

export interface ProgramInput {
  name: string;
  description?: string;
  domain: string;
  targetProtocol: TargetProtocol;
  targetHost: string;
  targetPort: number;
  healthCheckPath?: string;
  websocketEnabled: boolean;
  sslEnabled: boolean;
  enabled: boolean;
}

export interface ProgramDTO extends ProgramInput {
  id: string;
  configFileName: string;
  configStatus: ConfigStatus;
  healthStatus: HealthStatus;
  lastHealthCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInput {
  name: string;
  deviceType: string;
  programId?: string | null;
  location?: string;
  memo?: string;
  enabled: boolean;
}

export interface DeviceDTO extends DeviceInput {
  id: string;
  deviceId: string;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingDTO {
  apacheRootPath: string;
  apacheExecutablePath: string;
  apacheVhostsPath: string;
  managedSitesPath: string;
  backupPath: string;
  sslCertificatePath: string;
  sslCertificateKeyPath: string;
  defaultDomainSuffix: string;
  defaultHealthCheckTimeoutMs: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

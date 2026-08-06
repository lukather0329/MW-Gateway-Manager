import { z } from 'zod';

export const systemSettingSchema = z.object({
  apacheRootPath: z.string().trim().min(1),
  apacheExecutablePath: z.string().trim().min(1),
  apacheVhostsPath: z.string().trim().min(1),
  managedSitesPath: z.string().trim().min(1),
  backupPath: z.string().trim().min(1),
  sslCertificatePath: z.string().trim().min(1),
  sslCertificateKeyPath: z.string().trim().min(1),
  defaultDomainSuffix: z.string().trim().min(1),
  defaultHealthCheckTimeoutMs: z.coerce.number().int().min(100).max(60000),
});

export type SystemSettingParsed = z.infer<typeof systemSettingSchema>;

import { z } from 'zod';

export const programInputSchema = z.object({
  name: z.string().trim().min(1, '프로그램명을 입력해야 합니다.').max(100),
  description: z.string().trim().max(500).optional().default(''),
  domain: z.string().trim().min(1, '도메인을 입력해야 합니다.').max(253),
  targetProtocol: z.enum(['http', 'https']),
  targetHost: z.string().trim().min(1, '대상 IP/호스트를 입력해야 합니다.').max(253),
  targetPort: z.coerce.number().int(),
  healthCheckPath: z.string().trim().max(200).optional().default('/'),
  websocketEnabled: z.boolean().default(false),
  sslEnabled: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type ProgramInputParsed = z.infer<typeof programInputSchema>;

export const programUpdateSchema = programInputSchema.partial();

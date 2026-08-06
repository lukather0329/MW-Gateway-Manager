import { z } from 'zod';

export const deviceInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  deviceType: z.string().trim().min(1).max(50),
  programId: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(200).optional().default(''),
  memo: z.string().trim().max(1000).optional().default(''),
  enabled: z.boolean().default(true),
});

export type DeviceInputParsed = z.infer<typeof deviceInputSchema>;

export const deviceUpdateSchema = deviceInputSchema.partial();

import { Request, Response } from 'express';
import { systemSettingSchema } from '../validators/settingsSchema';
import { containsDangerousChars } from '../utils/validation';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';

export const get = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await services.settingsService.get();
  res.json(settings);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = systemSettingSchema.parse(req.body);

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && containsDangerousChars(value)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `${key} 값에 허용되지 않는 문자가 포함되어 있습니다.`,
      });
      return;
    }
  }

  const updated = await services.settingsService.update(input);
  await services.auditService.log({
    action: 'SETTINGS_UPDATE',
    actorUsername: req.session.username,
    result: 'SUCCESS',
  });
  res.json(updated);
});

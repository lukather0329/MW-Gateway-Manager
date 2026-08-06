import { Request, Response } from 'express';
import { services } from '../services/container';
import { asyncHandler } from '../utils/asyncHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const logs = await services.auditService.list(Number.isFinite(limit) ? limit : 100);
  res.json(logs);
});

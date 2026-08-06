import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    return;
  }
  next();
}

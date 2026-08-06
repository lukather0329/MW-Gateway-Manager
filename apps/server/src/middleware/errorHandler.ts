import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ValidationError } from '../utils/validation';
import { AuthError } from '../services/auth/AuthService';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: '입력값이 올바르지 않습니다.', details: err.issues });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: err.message });
    return;
  }
  if (err instanceof AuthError) {
    res.status(401).json({ error: 'AUTH_ERROR', message: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  // Never leak stack traces / internal details in production responses.
  if (env.nodeEnv !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: env.nodeEnv === 'production' ? '서버 오류가 발생했습니다.' : message,
  });
}

import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Issues (or reuses) a per-session CSRF token, exposed via GET /api/auth/csrf-token. */
export function issueCsrfToken(req: Request, res: Response): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.json({ csrfToken: req.session.csrfToken });
}

/**
 * Double-submit style CSRF check: the client must echo the session-bound
 * token back in the `x-csrf-token` header on every state-changing request.
 * Applied only to authenticated, mutating routes.
 */
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const headerToken = req.header('x-csrf-token');
  const sessionToken = req.session.csrfToken;
  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    res.status(403).json({ error: 'CSRF_INVALID', message: 'CSRF 토큰이 유효하지 않습니다.' });
    return;
  }
  next();
}

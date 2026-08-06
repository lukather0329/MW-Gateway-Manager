import { Request, Response } from 'express';
import { loginSchema } from '../validators/authSchema';
import { services } from '../services/container';
import { AuthError } from '../services/auth/AuthService';
import { asyncHandler } from '../utils/asyncHandler';
import { issueCsrfToken } from '../middleware/csrf';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = loginSchema.parse(req.body);

  try {
    const user = await services.authService.login(username, password);
    req.session.userId = user.id;
    req.session.username = user.username;
    await services.auditService.log({
      action: 'LOGIN_SUCCESS',
      actorUsername: user.username,
      result: 'SUCCESS',
    });
    res.json({ id: user.id, username: user.username });
  } catch (err) {
    await services.auditService.log({
      action: 'LOGIN_FAILURE',
      actorUsername: username,
      result: 'FAILURE',
      detail: { reason: err instanceof AuthError ? err.message : 'unknown' },
    });
    throw err;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const username = req.session.username;
  req.session.destroy(() => {
    res.clearCookie('mw.sid');
    res.json({ ok: true });
  });
  if (username) {
    await services.auditService.log({ action: 'LOGOUT', actorUsername: username, result: 'SUCCESS' });
  }
});

export const me = (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
    return;
  }
  res.json({ id: req.session.userId, username: req.session.username });
};

export const csrfToken = (req: Request, res: Response) => {
  issueCsrfToken(req, res);
};

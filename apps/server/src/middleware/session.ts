import session from 'express-session';
import { env } from '../config/env';

// MemoryStore is acceptable for the MVP scale (1-3 internal admins, single
// Node process). Sessions are lost on restart. See NEXT_STEPS.md if this
// needs to survive restarts or scale to multiple instances later.
export const sessionMiddleware = session({
  name: 'mw.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
});

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
    csrfToken?: string;
  }
}

import { LS, Cookie } from './storage';
import { SYNC_URL } from './sync';
import { SentryUtil } from './sentry';

export const AuthToken = {
  init: (_email: string): void => {},
  generate: (_email: string): string => '',
  getHeaders: (email?: string): Record<string, string> => {
    const sessionToken = LS.get<string>('ft-session-token');
    return {
      'Content-Type': 'application/json',
      ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
      'X-Auth-Token': email || 'legacy',
    };
  },
};

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
  attempts_remaining?: number;
}

export const SessionManager = {
  create: async (email: string, pin: string, deviceId?: string): Promise<AuthResult> => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(`${SYNC_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          email: email.toLowerCase(),
          pin,
          deviceId: deviceId || LS.get('ft-device-id'),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json = await res.json() as AuthResult & { token?: string; expires_at?: string };
      if (json.success && json.token) {
        LS.set('ft-session-token', json.token);
        LS.set('ft-session-email', email.toLowerCase());
        LS.set('ft-session-expires', json.expires_at);
        Cookie.set('ironlog_session', json.token, 30);
        return { success: true, token: json.token };
      }
      return { success: false, error: json.error, attempts_remaining: json.attempts_remaining };
    } catch { return { success: false, error: 'Connection failed' }; }
  },

  hasSession: (): boolean => {
    const token = LS.get<string>('ft-session-token');
    const expires = LS.get<string>('ft-session-expires');
    if (!token) return false;
    if (expires && new Date(expires) < new Date()) { LS.set('ft-session-token', null); return false; }
    return true;
  },

  revoke: async (): Promise<void> => {
    const token = LS.get<string>('ft-session-token');
    if (token) {
      try {
        await fetch(`${SYNC_URL}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          body: JSON.stringify({ action: 'revoke', token }),
        });
      } catch {}
    }
    SentryUtil.breadcrumb('User signed out', 'auth');
    SentryUtil.reset();
    LS.set('ft-session-token', null);
    LS.set('ft-session-email', null);
    LS.set('ft-session-expires', null);
    LS.set('ft-is-admin', null);
    Cookie.clear('ironlog_session');
  },

  checkAdmin: async (): Promise<boolean> => {
    const token = LS.get<string>('ft-session-token');
    const email = LS.get<string>('ft-session-email') || LS.get<{ email?: string }>('nl-profile')?.email;
    if (!token && !email) return false;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['X-Session-Token'] = token;
      if (email) headers['X-Auth-Token'] = email;
      const res = await fetch(`${SYNC_URL}/api/admin`, {
        method: 'POST', headers, body: JSON.stringify({ action: 'check' }),
      });
      if (res.ok) {
        const json = await res.json() as { isAdmin?: boolean };
        if (json.isAdmin) { LS.set('ft-is-admin', true); return true; }
      }
      LS.set('ft-is-admin', null);
      return false;
    } catch { return false; }
  },
};

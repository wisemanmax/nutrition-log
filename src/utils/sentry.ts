declare const Sentry: {
  setUser: (u: { email: string; username?: string } | null) => void;
  captureException: (e: unknown) => void;
  withScope: (cb: (scope: { setExtra: (k: string, v: unknown) => void }) => void) => void;
  addBreadcrumb: (b: { message: string; category?: string; data?: unknown; level?: string }) => void;
};

export const SentryUtil = {
  identify: (email: string, name?: string): void => {
    if (typeof Sentry === 'undefined') return;
    Sentry.setUser({ email, username: name || email.split('@')[0] });
  },
  reset: (): void => {
    if (typeof Sentry !== 'undefined') Sentry.setUser(null);
  },
  capture: (err: unknown, context?: Record<string, unknown>): void => {
    if (typeof Sentry === 'undefined') { console.error(err); return; }
    Sentry.withScope(scope => {
      if (context) Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(err);
    });
  },
  breadcrumb: (msg: string, category?: string, data?: unknown): void => {
    if (typeof Sentry === 'undefined') return;
    Sentry.addBreadcrumb({ message: msg, category: category || 'app', data, level: 'info' });
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', e => {
    if (typeof Sentry !== 'undefined') Sentry.captureException(e.reason || new Error('Unhandled rejection'));
  });
}

// Analytics wrapper — PostHog-compatible interface
// Drop PostHog SDK in later; for now events queue locally and flush to any PostHog-compatible endpoint.

interface AnalyticsPayload {
  event: string;
  distinctId: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

declare global {
  interface Window {
    __posthog?: {
      identify: (id: string, traits: Record<string, unknown>) => void;
      capture: (event: string, props: Record<string, unknown>) => void;
    };
  }
}

const QUEUE_KEY = 'nl-analytics-queue';
const MAX_QUEUE = 100;

function getQueue(): AnalyticsPayload[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function setQueue(q: AnalyticsPayload[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch {}
}

let _distinctId: string | null = null;
function getDistinctId(): string {
  if (_distinctId) return _distinctId;
  try {
    let id = localStorage.getItem('nl-analytics-id');
    if (!id) {
      id = crypto.randomUUID?.() || Date.now().toString(36);
      localStorage.setItem('nl-analytics-id', id);
    }
    _distinctId = id;
    return id;
  } catch { return 'anonymous'; }
}

export const Analytics = {
  identify: (userId: string, traits: Record<string, unknown> = {}): void => {
    _distinctId = userId;
    window.__posthog?.identify(userId, traits);
  },

  track: (event: string, properties: Record<string, unknown> = {}): void => {
    const payload: AnalyticsPayload = {
      event,
      distinctId: getDistinctId(),
      timestamp: new Date().toISOString(),
      properties: {
        ...properties,
        $app: 'nutrition-log',
        $url: window.location.href,
        $screen_width: window.screen.width,
        $screen_height: window.screen.height,
      },
    };

    window.__posthog?.capture(event, payload.properties);

    const queue = getQueue();
    queue.push(payload);
    setQueue(queue);

    if (import.meta.env.DEV) {
      console.debug('[Analytics]', event, properties);
    }
  },

  page: (pageName: string): void => {
    Analytics.track('$pageview', { page: pageName });
  },

  flush: async (endpoint: string): Promise<void> => {
    const queue = getQueue();
    if (!queue.length || !endpoint) return;
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: queue }),
        signal: AbortSignal.timeout(5000),
      });
      setQueue([]);
    } catch { /* retain queue for next flush */ }
  },
};

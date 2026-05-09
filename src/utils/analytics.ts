// Analytics wrapper — PostHog-compatible interface
// Drop in the PostHog SDK later; for now, events queue locally and batch-flush.

export type AnalyticsEvent =
  | 'meal_item_added'
  | 'meal_item_deleted'
  | 'meal_item_edited'
  | 'copy_from_yesterday'
  | 'template_applied'
  | 'template_saved'
  | 'barcode_scanned'
  | 'voice_log_started'
  | 'body_logged'
  | 'photo_added'
  | 'recipe_saved'
  | 'recipe_url_imported'
  | 'coach_message'
  | 'coach_insight_actioned'
  | 'goal_revised'
  | 'fast_started'
  | 'fast_stopped'
  | 'mood_logged'
  | 'onboarding_complete'
  | 'tab_view'
  | '$pageview'
  | string; // allow custom events

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  distinctId: string;
  timestamp: string;
  properties: Record<string, unknown>;
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
      id = crypto.randomUUID?.() ?? Date.now().toString(36);
      localStorage.setItem('nl-analytics-id', id);
    }
    _distinctId = id;
    return id;
  } catch { return 'anonymous'; }
}

declare global {
  interface Window { __posthog?: { identify(id: string, traits?: Record<string, unknown>): void; capture(event: string, props?: Record<string, unknown>): void; }; }
}

export const Analytics = {
  identify(userId: string, traits: Record<string, unknown> = {}): void {
    _distinctId = userId;
    window.__posthog?.identify(userId, traits);
  },

  track(event: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
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

    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
      console.debug('[Analytics]', event, properties);
    }
  },

  page(pageName: string): void {
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

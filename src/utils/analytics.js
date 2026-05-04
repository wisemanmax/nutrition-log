// Analytics wrapper — PostHog-compatible interface
// Drop-in PostHog SDK later; for now events go to console in dev and queue for batch send

const QUEUE_KEY = 'nl-analytics-queue';
const MAX_QUEUE = 100;

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function setQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch {}
}

let _distinctId = null;
function getDistinctId() {
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
  identify: (userId, traits = {}) => {
    _distinctId = userId;
    if (typeof window.__posthog !== 'undefined') {
      window.__posthog.identify(userId, traits);
    }
  },

  track: (event, properties = {}) => {
    const payload = {
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

    // Forward to PostHog if loaded
    if (typeof window.__posthog !== 'undefined') {
      window.__posthog.capture(event, payload.properties);
    }

    // Queue for batch send
    const queue = getQueue();
    queue.push(payload);
    setQueue(queue);

    if (import.meta.env.DEV) {
      console.debug('[Analytics]', event, properties);
    }
  },

  page: (pageName) => {
    Analytics.track('$pageview', { page: pageName });
  },

  // Flush queue to a PostHog-compatible endpoint
  flush: async (endpoint) => {
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

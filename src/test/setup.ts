import '@testing-library/jest-dom';

// IndexedDB mock for test environment
const idbMock = {
  stores: new Map(),
};

Object.defineProperty(global, 'indexedDB', {
  value: {
    open: () => ({
      addEventListener: () => {},
      result: { createObjectStore: () => {} },
    }),
  },
  writable: true,
});

// crypto.randomUUID mock
if (!global.crypto?.randomUUID) {
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () => Math.random().toString(36).slice(2),
      getRandomValues: (arr: Uint8Array) => { arr.fill(0); return arr; },
      subtle: {
        importKey: async () => ({}),
        deriveKey: async () => ({}),
        encrypt: async () => new ArrayBuffer(0),
        decrypt: async () => new ArrayBuffer(0),
      },
    },
    writable: true,
  });
}

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// navigator.vibrate mock
Object.defineProperty(global.navigator, 'vibrate', { value: () => true, writable: true });

// AbortSignal.timeout mock
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

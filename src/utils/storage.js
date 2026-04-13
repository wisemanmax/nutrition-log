// --- localStorage persistence ---

const _LS_CRYPTO_ALGO = { name: 'AES-GCM', length: 256 };
const _LS_CRYPTO_IV_LENGTH = 12;
const _LS_CRYPTO_KEY_LABEL = 'ironlog-ls-key-v1';

async function _getLsCryptoKey() {
  if (!('crypto' in window) || !window.crypto.subtle) return null;
  const enc = new TextEncoder();
  const material = enc.encode(_LS_CRYPTO_KEY_LABEL + '|' + window.location.origin);
  const keyMaterial = await window.crypto.subtle.importKey('raw', material, { name: 'PBKDF2' }, false, ['deriveKey']);
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ironlog-ls-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, _LS_CRYPTO_ALGO, false, ['encrypt', 'decrypt']
  );
}

async function _lsEncrypt(plainText) {
  const key = await _getLsCryptoKey();
  if (!key) return null;
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(_LS_CRYPTO_IV_LENGTH));
  const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plainText));
  const buff = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(iv.byteLength + buff.byteLength);
  combined.set(iv, 0);
  combined.set(buff, iv.byteLength);
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) binary += String.fromCharCode(combined[i]);
  return btoa(binary);
}

async function _lsDecrypt(cipherTextB64) {
  const key = await _getLsCryptoKey();
  if (!key) return null;
  try {
    const binary = atob(cipherTextB64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
    const iv = combined.slice(0, _LS_CRYPTO_IV_LENGTH);
    const data = combined.slice(_LS_CRYPTO_IV_LENGTH);
    const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plainBuf);
  } catch (e) { return null; }
}

export const LS = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  setSecure: async (k, v) => {
    try {
      const serialized = JSON.stringify(v);
      const encrypted = await _lsEncrypt(serialized);
      localStorage.setItem(k, encrypted !== null ? encrypted : serialized);
    } catch (e) {}
  },
  getSecure: async (k) => {
    try {
      const stored = localStorage.getItem(k);
      if (!stored) return null;
      const decrypted = await _lsDecrypt(stored);
      return JSON.parse(decrypted !== null ? decrypted : stored);
    } catch (e) { return null; }
  },
};

export const Cookie = {
  get: (name) => { const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)")); return m ? decodeURIComponent(m[2]) : null; },
  set: (name, value, days = 30) => {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    const domainAttr = window.location.hostname.endsWith("ironlog.space") ? ";domain=.ironlog.space" : "";
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp}${domainAttr};path=/;secure;samesite=lax`;
  },
  clear: (name) => {
    const domainAttr = window.location.hostname.endsWith("ironlog.space") ? ";domain=.ironlog.space" : "";
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT${domainAttr};path=/;secure`;
  },
};

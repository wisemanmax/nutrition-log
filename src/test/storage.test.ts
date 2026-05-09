import { describe, it, expect, beforeEach } from 'vitest';
import { LS } from '../utils/storage';

describe('LS (localStorage)', () => {
  beforeEach(() => localStorage.clear());

  it('set and get round-trip', () => {
    LS.set('test-key', { foo: 'bar', num: 42 });
    const result = LS.get<{ foo: string; num: number }>('test-key');
    expect(result).toEqual({ foo: 'bar', num: 42 });
  });

  it('returns null for missing key', () => {
    expect(LS.get('nonexistent')).toBeNull();
  });

  it('handles arrays', () => {
    const arr = [1, 2, { x: 'y' }];
    LS.set('arr-key', arr);
    expect(LS.get('arr-key')).toEqual(arr);
  });

  it('overwrites existing value', () => {
    LS.set('overwrite', 'first');
    LS.set('overwrite', 'second');
    expect(LS.get('overwrite')).toBe('second');
  });

  it('remove clears a key', () => {
    LS.set('to-remove', 'value');
    LS.remove('to-remove');
    expect(LS.get('to-remove')).toBeNull();
  });

  it('handles JSON parse errors gracefully', () => {
    localStorage.setItem('bad-json', '{not valid json}');
    expect(LS.get('bad-json')).toBeNull();
  });
});

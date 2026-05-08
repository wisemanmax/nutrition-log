import { describe, it, expect, beforeEach } from 'vitest';
import { LS } from '../utils/storage.ts';

describe('LS (localStorage) — TypeScript version', () => {
  beforeEach(() => localStorage.clear());

  it('set and get round-trip with typed generic', () => {
    LS.set('test-obj', { foo: 'bar', num: 42 });
    const result = LS.get<{ foo: string; num: number }>('test-key');
    // different key — should be null
    expect(result).toBeNull();
  });

  it('set and get same key round-trips correctly', () => {
    const data = { x: 1, y: [2, 3] };
    LS.set('typed-key', data);
    expect(LS.get('typed-key')).toEqual(data);
  });

  it('returns null for missing key', () => {
    expect(LS.get('nonexistent')).toBeNull();
  });

  it('remove deletes the key', () => {
    LS.set('to-remove', 'value');
    expect(LS.get('to-remove')).toBe('value');
    LS.remove('to-remove');
    expect(LS.get('to-remove')).toBeNull();
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

  it('handles null / undefined gracefully', () => {
    LS.set('null-val', null);
    expect(LS.get('null-val')).toBeNull(); // JSON.parse(null) — safe
  });

  it('handles numbers', () => {
    LS.set('num', 42.5);
    expect(LS.get('num')).toBe(42.5);
  });

  it('handles booleans', () => {
    LS.set('bool', true);
    expect(LS.get('bool')).toBe(true);
  });
});

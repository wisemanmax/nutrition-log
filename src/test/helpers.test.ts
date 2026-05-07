import { describe, it, expect } from 'vitest';
import { today, ago, fmtDate, safeAdd, safeSub, safeSum, isValidEmail, toKg, toLbs } from '../utils/helpers';

describe('helpers', () => {
  it('today() returns YYYY-MM-DD format', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ago(0) equals today()', () => {
    expect(ago(0)).toBe(today());
  });

  it('ago(1) is yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(ago(1)).toBe(d.toISOString().split('T')[0]);
  });

  it('fmtDate returns "Today" for today', () => {
    expect(fmtDate(today())).toBe('Today');
  });

  it('fmtDate returns "Yesterday" for ago(1)', () => {
    expect(fmtDate(ago(1))).toBe('Yesterday');
  });

  it('safeAdd avoids float errors', () => {
    expect(safeAdd(0.1, 0.2)).toBeCloseTo(0.3);
  });

  it('safeSub works', () => {
    expect(safeSub(1.5, 0.5)).toBe(1);
  });

  it('safeSum handles array', () => {
    expect(safeSum([1.1, 2.2, 3.3])).toBeCloseTo(6.6);
  });

  it('isValidEmail', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('toKg and toLbs are inverse', () => {
    const lbs = 180;
    expect(Math.abs(toLbs(toKg(lbs)) - lbs)).toBeLessThan(0.5);
  });
});

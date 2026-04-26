import { describe, it, expect } from 'vitest';
import { isMatch } from '@/lib/match';

describe('isMatch', () => {
  it('returns true for identical strings', () => {
    expect(isMatch('吃', '吃')).toBe(true);
  });

  it('trims leading and trailing whitespace', () => {
    expect(isMatch('  吃 ', '吃')).toBe(true);
  });

  it('returns false for partial match', () => {
    expect(isMatch('吃', '吃饭')).toBe(false);
  });

  it('is case sensitive (English ascii)', () => {
    expect(isMatch('Apple', 'apple')).toBe(false);
  });

  it('handles Japanese characters correctly', () => {
    expect(isMatch('食べる', '食べる')).toBe(true);
    expect(isMatch('たべる', '食べる')).toBe(false);
  });

  it('empty user input is never a match', () => {
    expect(isMatch('', '吃')).toBe(false);
    expect(isMatch('   ', '吃')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeLemma } from '../../src/lib/normalize';

describe('normalizeLemma', () => {
  it('lowercases text', () => {
    expect(normalizeLemma('Chat')).toBe('chat');
    expect(normalizeLemma('MAISON')).toBe('maison');
  });

  it('trims whitespace', () => {
    expect(normalizeLemma('  chat  ')).toBe('chat');
  });

  it('applies NFC unicode normalization', () => {
    // é as e + combining acute accent (NFD) vs single char (NFC)
    const nfd = 'e\u0301';
    const nfc = '\u00e9';
    expect(normalizeLemma(nfd)).toBe(normalizeLemma(nfc));
  });

  it('preserves accented characters', () => {
    expect(normalizeLemma('où')).toBe('où');
    expect(normalizeLemma('Éléphant')).toBe('éléphant');
    expect(normalizeLemma('CAFÉ')).toBe('café');
  });

  it('handles empty string', () => {
    expect(normalizeLemma('')).toBe('');
  });
});

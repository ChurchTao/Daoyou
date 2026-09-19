import { describe, expect, it } from 'vitest';
import { createTextFilter } from './index';

const dictionary = {
  blockedWords: ['坏蛋', '骗子', 'bad'],
  allowedPhrases: ['坏蛋糕'],
};

describe('text filter', () => {
  const filter = createTextFilter(dictionary);

  it('preserves unmodified text and handles an empty dictionary', () => {
    expect(filter.mask('🍰正常文字 ABC')).toEqual({
      text: '🍰正常文字 ABC',
      changed: false,
    });
    expect(filter.mask('')).toEqual({ text: '', changed: false });
    expect(
      createTextFilter({ blockedWords: [], allowedPhrases: [] }).mask('坏蛋')
        .text,
    ).toBe('坏蛋');
  });

  it('masks every occurrence and only exempts contained matches', () => {
    expect(filter.mask('这是坏蛋糕，你是坏蛋和骗子')).toEqual({
      text: '这是坏蛋糕，你是**和**',
      changed: true,
    });
    const overlapping = createTextFilter({
      blockedWords: ['甲乙', '乙丙'],
      allowedPhrases: ['丁甲乙'],
    });
    expect(overlapping.mask('丁甲乙丙').text).toBe('丁甲**');
  });

  it('merges overlapping matches and finds longer words sharing a prefix', () => {
    const overlapping = createTextFilter({
      blockedWords: ['甲乙', '乙丙', '甲乙丙丁'],
      allowedPhrases: [],
    });
    expect(overlapping.mask('甲乙丙丁').text).toBe('****');
  });

  it('normalizes ASCII case and full width without rewriting other text', () => {
    expect(filter.mask('ＡＢＣ ＢａＤ！').text).toBe('ＡＢＣ ***！');
    const fullWidth = createTextFilter({
      blockedWords: ['ＢＡＤ'],
      allowedPhrases: [],
    });
    expect(fullWidth.mask('bad').text).toBe('***');
  });

  it.each([' ', '.', '·', '_', '-', '．', '　'])(
    'skips one permitted separator: %s',
    (separator) => {
      expect(filter.mask(`骗${separator}子`).text).toBe('***');
    },
  );

  it.each(['  ', '--', '.-', ',', '，', '。', '\n', '\r', '\t', '!', '、'])(
    'does not cross a boundary or multiple separators: %j',
    (separator) => {
      const text = `骗${separator}子`;
      expect(filter.mask(text)).toEqual({ text, changed: false });
    },
  );

  it('counts the separator limit per gap, including gaps with invisible characters', () => {
    expect(filter.mask('b.a-d').text).toBe('*****');
    expect(filter.mask('骗.\u200b-子').changed).toBe(false);
  });

  it.each(['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff'])(
    'ignores a specified invisible character: %j',
    (character) => {
      expect(filter.mask(`骗${character}子`).text).toBe('***');
      expect(filter.mask(`${character}骗子${character}`).text).toBe(
        `${character}**${character}`,
      );
    },
  );

  it('does not let obfuscation expand an allowed phrase', () => {
    expect(filter.mask('坏.蛋糕').text).toBe('***糕');
    expect(filter.mask('坏\u200b蛋糕').text).toBe('***糕');
  });

  it('maps code points back to the original text and preserves unrelated emoji', () => {
    const unicode = createTextFilter({
      blockedWords: ['𠮷蛋'],
      allowedPhrases: [],
    });
    expect(unicode.mask('👨‍👩‍👧 𠮷.蛋!').text).toBe('👨‍👩‍👧 ***!');
    expect(filter.mask('😀骗\u200b.子👩‍💻').text).toBe('😀****👩‍💻');
  });

  it('preserves literal phrase matching as well as separator skipping', () => {
    const phrases = createTextFilter({
      blockedWords: ['a b', 'a.b'],
      allowedPhrases: [],
    });
    expect(phrases.mask('a b / a.b').text).toBe('*** / ***');
  });

  it('does not infer traditional characters, homophones, or repeated characters', () => {
    expect(filter.mask('騙子 pianzi 片子 baad').changed).toBe(false);
  });

  it('is idempotent', () => {
    const once = filter.mask('坏蛋糕，骗.子与ＢＡＤ').text;
    expect(filter.mask(once)).toEqual({ text: once, changed: false });
  });

  it.each([
    {},
    { blockedWords: [1], allowedPhrases: [] },
    { blockedWords: [''], allowedPhrases: [] },
    { blockedWords: ['   '], allowedPhrases: [] },
    { blockedWords: ['\u200b'], allowedPhrases: [] },
    { blockedWords: [' 坏蛋'], allowedPhrases: [] },
    { blockedWords: ['bad', 'ＢＡＤ'], allowedPhrases: [] },
    { blockedWords: [], allowedPhrases: ['bad', 'BAD'] },
    { blockedWords: ['bad'], allowedPhrases: ['ＢＡＤ'] },
    { blockedWords: ['*'], allowedPhrases: [] },
    { blockedWords: [], allowedPhrases: [], typo: [] },
  ])('rejects invalid or ambiguous dictionaries: %j', (input) => {
    expect(() => createTextFilter(input)).toThrow();
  });
});

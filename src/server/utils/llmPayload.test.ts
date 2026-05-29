import { describe, expect, it } from 'vitest';
import {
  normalizeFreeformLlmInput,
  stableCompactStringify,
  truncateText,
} from './llmPayload';

describe('llmPayload helpers', () => {
  it('normalizes freeform prompt input conservatively', () => {
    expect(
      normalizeFreeformLlmInput('  请帮我   做一个  雷火风格的功法！！！！ 谢谢  '),
    ).toBe('做一个 雷火风格的功法！');
  });

  it('stable-stringifies nested objects without pretty spaces', () => {
    expect(
      stableCompactStringify({
        b: 1,
        a: {
          d: 2,
          c: 3,
        },
      }),
    ).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('truncates long text with ellipsis', () => {
    expect(truncateText('天地玄黄宇宙洪荒', 7)).toBe('天地玄黄...');
  });
});

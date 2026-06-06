import { describe, expect, it } from 'vitest';
import {
  QI_INSUFFICIENT_FRIENDLY_MESSAGE,
  getQiActionConfirmText,
  getQiErrorMessage,
  normalizeQiErrorMessage,
} from './useQiActionConfirm';

describe('qi action confirm helpers', () => {
  it('builds the shared qi cost confirmation copy', () => {
    expect(getQiActionConfirmText('秘境探索', 50)).toBe(
      '本次秘境探索将消耗 50 天地灵气。',
    );
  });

  it('normalizes QI_INSUFFICIENT api payloads', () => {
    expect(
      getQiErrorMessage(
        { error: 'QI_INSUFFICIENT', message: '天地灵气不足' },
        '操作失败',
      ),
    ).toBe(QI_INSUFFICIENT_FRIENDLY_MESSAGE);
  });

  it('normalizes QI_INSUFFICIENT thrown errors', () => {
    expect(normalizeQiErrorMessage(new Error('QI_INSUFFICIENT'), '操作失败')).toBe(
      QI_INSUFFICIENT_FRIENDLY_MESSAGE,
    );
  });
});

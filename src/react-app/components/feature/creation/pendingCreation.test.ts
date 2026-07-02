import { describe, expect, it } from 'vitest';
import {
  getPendingCreationConfig,
  getPendingCreationNoticeText,
  getPendingCreationReplaceHref,
  isPendingCreationCraftType,
  resolvePendingCreationRoute,
} from './pendingCreationHelpers';

describe('pending creation helpers', () => {
  it('maps craft types to replacement and owner routes', () => {
    expect(getPendingCreationReplaceHref('create_gongfa')).toBe(
      '/game/enlightenment/replace?type=create_gongfa',
    );
    expect(getPendingCreationReplaceHref('create_skill')).toBe(
      '/game/enlightenment/replace?type=create_skill',
    );
    expect(getPendingCreationConfig('create_gongfa').ownerHref).toBe(
      '/game/techniques',
    );
    expect(getPendingCreationConfig('create_skill').ownerHref).toBe(
      '/game/skills',
    );
  });

  it('recognizes only replacement-managed creation craft types', () => {
    expect(isPendingCreationCraftType('create_gongfa')).toBe(true);
    expect(isPendingCreationCraftType('create_skill')).toBe(true);
    expect(isPendingCreationCraftType('refine')).toBe(false);
    expect(isPendingCreationCraftType(null)).toBe(false);
  });

  it('builds clear blocked-create copy for each pending type', () => {
    expect(getPendingCreationNoticeText('create_gongfa')).toContain(
      '新功法',
    );
    expect(getPendingCreationNoticeText('create_gongfa')).toContain(
      '继续参悟',
    );
    expect(getPendingCreationNoticeText('create_skill')).toContain('新神通');
    expect(getPendingCreationNoticeText('create_skill')).toContain(
      '继续推演',
    );
  });

  it('resolves replacement route state from query and pending records', () => {
    expect(
      resolvePendingCreationRoute({
        requestedType: 'create_gongfa',
        pendingTypes: [],
      }),
    ).toEqual({ mode: 'typed', craftType: 'create_gongfa' });

    expect(
      resolvePendingCreationRoute({
        requestedType: null,
        pendingTypes: ['create_skill'],
      }),
    ).toEqual({ mode: 'single', craftType: 'create_skill' });

    expect(
      resolvePendingCreationRoute({
        requestedType: null,
        pendingTypes: ['create_gongfa', 'create_skill'],
      }),
    ).toEqual({
      mode: 'multiple',
      pendingTypes: ['create_gongfa', 'create_skill'],
    });

    expect(
      resolvePendingCreationRoute({
        requestedType: null,
        pendingTypes: [],
      }),
    ).toEqual({ mode: 'empty' });

    expect(
      resolvePendingCreationRoute({
        requestedType: 'refine',
        pendingTypes: ['create_gongfa'],
      }),
    ).toEqual({ mode: 'invalid_type' });
  });
});

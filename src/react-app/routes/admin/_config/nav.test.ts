import { describe, expect, it } from 'vitest';
import { adminNavItems } from './nav';

describe('admin nav config', () => {
  it('includes online users page entry', () => {
    expect(adminNavItems).toContainEqual(
      expect.objectContaining({
        title: '在线人数',
        href: '/admin/online-users',
      }),
    );
  });
});

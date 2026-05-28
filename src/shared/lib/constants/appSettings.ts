/** Keys for `wanjiedaoyou_app_settings.key` — keep in sync with DB migrations */
export const APP_SETTING_KEYS = {
  communityQqGroupNumber: 'community_qq_group_number',
  authPageAnnouncement: 'auth_page_announcement',
} as const;

/** Bundled fallback when DB has no row or row is empty. */
export const DEFAULT_COMMUNITY_QQ_GROUP_NUMBER = '1107586928';

/** Keys for `wanjiedaoyou_app_settings.key` — keep in sync with DB migrations */
export const APP_SETTING_KEYS = {
  communityQrcodeSourceUrl: 'community_qrcode_source_url',
} as const;

/** Bundled fallback when DB has no row or row is empty (same as legacy hardcoded URL) */
export const DEFAULT_COMMUNITY_QR_CODE_SOURCE =
  'https://page-r2.daoyou.org/index/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20260318172027_212_37.jpg';

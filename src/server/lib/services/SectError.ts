export type SectErrorCode =
  | 'SECT_UNKNOWN'
  | 'SECT_TRIAL_REQUIRED'
  | 'SECT_ALREADY_JOINED'
  | 'SECT_REALM_GATE'
  | 'SECT_METHOD_CAP'
  | 'SECT_PATH_UNKNOWN'
  | 'SECT_PATH_NOT_LEARNED'
  | 'SECT_PATH_ALREADY_LEARNED'
  | 'SECT_INSUFFICIENT_RESOURCES'
  | 'SECT_INVALID_MERIDIAN'
  | 'SECT_INVALID_LOADOUT'
  | 'SECT_COMMISSION_ALREADY_CLAIMED'
  | 'SECT_ORGANIZATION_INVALID';

export class SectError extends Error {
  constructor(
    public readonly code: SectErrorCode,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
  }
}

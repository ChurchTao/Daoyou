export type ApiSuccess<TData, TMeta = undefined> = {
  success: true;
  data: TData;
  meta?: TMeta;
};

export type ApiFailure = {
  success: false;
  error: string;
  details?: unknown;
};

export type ApiResult<TData, TMeta = undefined> =
  | ApiSuccess<TData, TMeta>
  | ApiFailure;

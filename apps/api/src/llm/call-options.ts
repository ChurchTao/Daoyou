/** The deadline covers retries and the entire stream, beyond a native attempt's timeout. */
export function aiDeadlineSignal(
  timeoutMs = 120_000,
  parent?: AbortSignal,
): AbortSignal {
  const deadline = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, deadline]) : deadline;
}

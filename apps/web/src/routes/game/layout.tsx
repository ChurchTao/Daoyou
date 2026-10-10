import type { ShouldRevalidateFunctionArgs } from 'react-router';

export { default } from '@app/layouts/game-layout';
export { requireUserLoader as loader } from '@app/lib/router/loaders';

// Query changes are view state. Re-checking the session here only adds a
// get-session request; API handlers remain the authorization boundary.
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
  formMethod,
}: ShouldRevalidateFunctionArgs) {
  if (
    !formMethod &&
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}

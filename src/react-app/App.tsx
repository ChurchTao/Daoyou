import { InkUIProvider } from '@app/components/providers/InkUIProvider';
import Link from '@app/components/router/AppLink';
import { RouteDocumentTitle } from '@app/components/router/RouteDocumentTitle';
import { AuthProvider } from '@app/lib/auth/AuthContext';
import { APP_TITLE, formatDocumentTitle } from '@app/lib/router/routeTitle';
import {
  Outlet,
  ScrollRestoration,
  isRouteErrorResponse,
  useNavigation,
  useRouteError,
} from 'react-router';

function NavigationIndicator() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== 'idle';

  return (
    <div
      aria-hidden="true"
      className={`bg-crimson pointer-events-none fixed top-0 right-0 left-0 z-200 h-0.5 transition-opacity duration-150 ${
        isNavigating ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InkUIProvider>
        <RouteDocumentTitle />
        <ScrollRestoration />
        <NavigationIndicator />
        <Outlet />
      </InkUIProvider>
    </AuthProvider>
  );
}

export function RootRouteErrorBoundary() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? typeof error.data === 'string'
      ? error.data
      : error.statusText || '页面加载失败'
    : error instanceof Error
      ? error.message
      : '页面加载失败';

  return (
    <div className="bg-paper flex min-h-screen items-center justify-center px-6">
      <title>{formatDocumentTitle('道途异常')}</title>
      <div className="border-ink/15 bg-bgpaper/90 w-full max-w-xl rounded border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          {APP_TITLE}
        </p>
        <h1 className="text-ink mt-3 text-2xl font-semibold">道途出现偏差</h1>
        <p className="text-ink-secondary mt-3 text-sm leading-7">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="border-ink/20 text-ink hover:border-crimson/40 hover:text-crimson rounded border px-3 py-2 no-underline"
          >
            返回首页
          </Link>
          <Link
            href="/game"
            className="border-ink/20 text-ink hover:border-crimson/40 hover:text-crimson rounded border px-3 py-2 no-underline"
          >
            返回游戏
          </Link>
        </div>
      </div>
    </div>
  );
}

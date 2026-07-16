import { AppVersionNotifier } from '@app/components/feature/app-version/AppVersionNotifier';
import { InkUIProvider } from '@app/components/providers/InkUIProvider';
import Link from '@app/components/router/AppLink';
import { RouteDocumentTitle } from '@app/components/router/RouteDocumentTitle';
import {
  isDynamicImportError,
  reloadIntoLatestVersion,
} from '@app/lib/appVersion';
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
    <InkUIProvider>
      <AppVersionNotifier />
      <RouteDocumentTitle />
      <ScrollRestoration />
      <NavigationIndicator />
      <Outlet />
    </InkUIProvider>
  );
}

export function RootRouteErrorBoundary() {
  const error = useRouteError();

  return <RootRouteErrorView error={error} />;
}

export function RootRouteErrorView({ error }: { error: unknown }) {
  const isVersionError = isDynamicImportError(error);

  const message = isVersionError
    ? '你停留的版本已被新的天地法则替代，刷新后即可继续当前旅程。'
    : isRouteErrorResponse(error)
      ? typeof error.data === 'string'
        ? error.data
        : error.statusText || '页面加载失败'
      : error instanceof Error
        ? error.message
        : '页面加载失败';
  const pageTitle = isVersionError ? '版本已更迭' : '道途异常';

  return (
    <div className="bg-paper flex min-h-screen items-center justify-center px-6">
      <title>{formatDocumentTitle(pageTitle)}</title>
      <div className="w-full max-w-xl p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          {APP_TITLE}
        </p>
        <h1 className="text-ink mt-3 text-2xl font-semibold">
          {isVersionError ? '版本已更迭' : '道途出现偏差'}
        </h1>
        <p className="text-ink-secondary mt-3 text-sm leading-7">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isVersionError ? (
            <>
              <button
                type="button"
                onClick={reloadIntoLatestVersion}
                className="border-crimson/40 text-crimson hover:bg-crimson/5 cursor-pointer border px-3 py-2"
              >
                刷新进入新版本
              </button>
              <a
                href="/"
                className="border-ink/20 text-ink hover:border-crimson/40 hover:text-crimson border border-dashed px-3 py-2 no-underline"
              >
                返回首页
              </a>
            </>
          ) : (
            <>
              <Link
                href="/"
                className="border-ink/20 text-ink hover:border-crimson/40 hover:text-crimson border border-dashed px-3 py-2 no-underline"
              >
                返回首页
              </Link>
              <Link
                href="/game"
                className="border-ink/20 text-ink hover:border-crimson/40 hover:text-crimson border border-dashed px-3 py-2 no-underline"
              >
                返回游戏
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

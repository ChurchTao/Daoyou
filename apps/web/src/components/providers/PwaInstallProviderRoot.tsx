import {
  getPwaInstallSnapshot,
  requestPwaInstall,
  subscribePwaInstall,
} from '@app/lib/pwaInstall';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useInkUI } from './InkUIProvider';
import { PwaInstallContext } from './pwaInstallContext';

function ManualInstallInstructions({ ios }: { ios: boolean }) {
  return ios ? (
    <ol className="text-ink-secondary list-decimal space-y-2 pl-5 text-sm leading-7">
      <li>使用 Safari 打开万界道友。</li>
      <li>点击浏览器工具栏中的“分享”。</li>
      <li>选择“添加到主屏幕”，再点击“添加”。</li>
    </ol>
  ) : (
    <p className="text-ink-secondary text-sm leading-7">
      打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。若菜单中没有该选项，
      当前浏览器暂不支持安装。
    </p>
  );
}

export function PwaInstallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const installSnapshot = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot,
  );
  const { openDialog } = useInkUI();

  const install = useCallback(async () => {
    const outcome = await requestPwaInstall();
    if (outcome === 'manual') {
      openDialog({
        title: '添加到主屏幕',
        content: <ManualInstallInstructions ios={installSnapshot.ios} />,
        confirmLabel: '知道了',
        cancelLabel: null,
      });
    }
    return outcome;
  }, [installSnapshot.ios, openDialog]);

  const value = useMemo(
    () => ({
      status: installSnapshot.status,
      standalone: installSnapshot.standalone,
      install,
    }),
    [install, installSnapshot.standalone, installSnapshot.status],
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
}

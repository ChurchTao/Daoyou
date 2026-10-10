import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
} from '@app/components/game-shell';
import { usePwaInstall } from '@app/components/providers/PwaInstallProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import type { PwaInstallOutcome, PwaInstallStatus } from '@app/lib/pwaInstall';
import { useState } from 'react';

type InstallPlatform = 'ios' | 'android' | 'desktop';

const PLATFORMS: { id: InstallPlatform; label: string }[] = [
  { id: 'ios', label: '苹果手机' },
  { id: 'android', label: '安卓手机' },
  { id: 'desktop', label: '电脑' },
];

const STEPS: Record<InstallPlatform, readonly string[]> = {
  ios: [
    '用 Safari 打开万界道友。',
    '点 Safari 的分享按钮。',
    '选择「添加到主屏幕」，再点「添加」。',
    '回到主屏幕，点「万界道友」图标进入。',
  ],
  android: [
    '用 Chrome 或手机自带浏览器打开万界道友。',
    '打开浏览器右上角菜单。',
    '选择「安装应用」「添加到主屏幕」或「添加至桌面」，再确认。',
    '从主屏幕的「万界道友」图标进入。',
  ],
  desktop: [
    '用 Chrome 或 Edge 打开万界道友。',
    '点地址栏右侧的安装图标。没有图标时，打开浏览器菜单，选择安装应用。',
    '确认后，从桌面、开始菜单或程序坞打开「万界道友」。',
  ],
};

function detectInstallPlatform(ios: boolean): InstallPlatform {
  if (ios) return 'ios';
  if (
    typeof navigator !== 'undefined' &&
    /Android/i.test(navigator.userAgent)
  ) {
    return 'android';
  }
  return 'desktop';
}

function isEmbeddedBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger|QQ\/|Weibo|aweme|DingTalk|AlipayClient|BytedanceWebview/i.test(
    navigator.userAgent,
  );
}

function installOutcomeMessage(outcome: PwaInstallOutcome) {
  if (outcome === 'accepted') return '安装请求已接受。请从新出现的图标打开。';
  if (outcome === 'dismissed')
    return '已取消安装。也可以按下面的步骤手动添加。';
  if (outcome === 'unavailable') return '当前环境无法安装。';
  return null;
}

function InstallLead({
  standalone,
  status,
  onInstall,
}: {
  standalone: boolean;
  status: PwaInstallStatus;
  onInstall: () => void;
}) {
  if (standalone) {
    return (
      <p className="text-ink text-sm leading-7">
        你正在从主屏幕图标进入。换一台设备时，按下面的步骤再装一次。
      </p>
    );
  }

  if (status === 'installed') {
    return (
      <p className="text-ink text-sm leading-7">
        这台设备已经安装。请从主屏幕或程序坞打开「万界道友」。
      </p>
    );
  }

  if (status === 'unavailable') {
    return (
      <p className="text-ink text-sm leading-7">
        当前环境无法安装。请用手机或电脑的系统浏览器打开正式地址。
      </p>
    );
  }

  if (status === 'promptable') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-ink text-sm leading-7">这台浏览器可以直接安装。</p>
        <InkButton variant="primary" onClick={onInstall}>
          安装到设备
        </InkButton>
      </div>
    );
  }

  return null;
}

export default function DownloadGamePage() {
  const pwa = usePwaInstall();
  const [platform, setPlatform] = useState<InstallPlatform>(() =>
    detectInstallPlatform(pwa.ios),
  );
  const [embeddedBrowser] = useState(isEmbeddedBrowser);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const steps = STEPS[platform];
  const platformLabel =
    PLATFORMS.find((item) => item.id === platform)?.label ?? '当前设备';

  const handleInstall = async () => {
    const outcome = await pwa.install();
    setInstallMessage(installOutcomeMessage(outcome));
  };

  return (
    <GameSceneFrame
      variant="lite"
      title="下载游戏"
      aside={
        <GameSceneAsideSection title="进入之后" className="text-sm leading-7">
          <p>从图标打开后没有地址栏，登录的仍是原来的账号。</p>
          <p className="mt-2">
            修炼和战斗需要网络。有新版本时，页面会提示刷新。
          </p>
        </GameSceneAsideSection>
      }
    >
      <div className="space-y-5">
        {embeddedBrowser ? (
          <GameSceneNote>
            微信、QQ 等应用内页面不能安装。请先点菜单，选择在系统浏览器中打开。
          </GameSceneNote>
        ) : null}

        <InstallLead
          standalone={pwa.standalone}
          status={pwa.status}
          onInstall={() => void handleInstall()}
        />

        {installMessage ? (
          <p className="text-ink-secondary text-sm leading-7">
            {installMessage}
          </p>
        ) : null}

        <div
          role="group"
          aria-label="选择设备"
          className="flex flex-wrap gap-2"
        >
          {PLATFORMS.map((item) => (
            <InkChoiceButton
              key={item.id}
              selected={platform === item.id}
              onClick={() => setPlatform(item.id)}
              className="py-1.5"
            >
              {item.label}
            </InkChoiceButton>
          ))}
        </div>

        <ol
          aria-label={`${platformLabel}安装步骤`}
          className="text-ink list-decimal space-y-3 pl-5 text-sm leading-7"
        >
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {platform === 'desktop' ? (
          <p className="text-ink-secondary text-sm leading-7">
            Mac 上的 Safari 可从「文件」菜单选择「添加到程序坞」。
          </p>
        ) : null}
      </div>
    </GameSceneFrame>
  );
}

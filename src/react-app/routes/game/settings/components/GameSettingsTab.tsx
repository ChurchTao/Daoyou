import { usePwaInstall } from '@app/components/providers/PwaInstallProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { updateGameSettings, useGameSettings } from '@app/lib/game-setting';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { useState } from 'react';
import {
  SettingsField,
  SettingsMessage,
  SettingsSection,
  settingsLabelClass,
} from './SettingsFields';
import { formatDateTime } from './utils';

export function GameSettingsTab() {
  const { mapMode, imageOpacity } = useGameSettings();
  const cultivator = useCultivatorIdentity().data?.cultivator;
  const pwa = usePwaInstall();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const cultivatorId = cultivator?.id ?? '';

  const handleCopyCultivatorId = async () => {
    if (!cultivatorId) return;

    try {
      await navigator.clipboard.writeText(cultivatorId);
      setCopyMessage('已复制');
    } catch {
      setCopyMessage('复制失败');
    }
  };

  const handleInstall = async () => {
    const outcome = await pwa.install();
    setInstallMessage(
      outcome === 'accepted'
        ? '安装请求已接受'
        : outcome === 'dismissed'
          ? '已取消安装'
          : outcome === 'unavailable'
            ? '当前环境无法安装'
            : null,
    );
  };

  const installValue =
    pwa.status === 'installed'
      ? pwa.standalone
        ? '已从主屏幕启动'
        : '已安装到设备'
      : pwa.status === 'promptable'
        ? '可直接安装'
        : pwa.status === 'manual'
          ? '可手动添加到主屏幕'
          : '当前环境不可安装';

  return (
    <div className="space-y-6">
      <SettingsSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="game-image-opacity" className={settingsLabelClass}>
            图片显示强度
            <output htmlFor="game-image-opacity" className="ml-3 font-mono">
              {Math.round(imageOpacity * 100)}%
            </output>
          </label>
          <InkButton
            variant="secondary"
            disabled={imageOpacity === 1}
            onClick={() => updateGameSettings({ imageOpacity: 1 })}
          >
            恢复默认
          </InkButton>
        </div>
        <input
          id="game-image-opacity"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(imageOpacity * 100)}
          aria-valuetext={`${Math.round(imageOpacity * 100)}%`}
          className="accent-crimson focus-visible:outline-crimson mt-2 h-11 w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
          onChange={(event) =>
            updateGameSettings({
              imageOpacity: event.currentTarget.valueAsNumber / 100,
            })
          }
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsField
          label="地图显示"
          value={null}
          action={
            <div role="group" aria-label="地图显示方式" className="flex gap-2">
              {(['atlas', 'text'] as const).map((mode) => (
                <InkButton
                  key={mode}
                  variant={mapMode === mode ? 'primary' : 'secondary'}
                  aria-pressed={mapMode === mode}
                  onClick={() => updateGameSettings({ mapMode: mode })}
                >
                  {mode === 'atlas' ? '画卷' : '文字'}
                </InkButton>
              ))}
            </div>
          }
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsField
          label="角色 ID"
          value={cultivatorId || '—'}
          mono
          action={
            cultivatorId ? (
              <InkButton variant="secondary" onClick={handleCopyCultivatorId}>
                复制
              </InkButton>
            ) : null
          }
        />
        <SettingsField
          label="角色创建时间"
          value={formatDateTime(cultivator?.createdAt)}
        />
      </SettingsSection>
      {copyMessage ? <SettingsMessage>{copyMessage}</SettingsMessage> : null}
      <SettingsSection>
        <SettingsField
          label="应用安装"
          value={installValue}
          action={
            pwa.status === 'installed' ||
            pwa.status === 'unavailable' ? null : (
              <InkButton
                variant="secondary"
                onClick={() => void handleInstall()}
              >
                {pwa.status === 'promptable' ? '安装到设备' : '查看方法'}
              </InkButton>
            )
          }
        />
      </SettingsSection>
      {installMessage ? (
        <SettingsMessage>{installMessage}</SettingsMessage>
      ) : null}
    </div>
  );
}

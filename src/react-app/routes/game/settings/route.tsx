import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { AccountSettingsTab } from './components/AccountSettingsTab';
import { ConnectionStatusTab } from './components/ConnectionStatusTab';
import { GameSettingsTab } from './components/GameSettingsTab';
import { ModelConfigTab } from './components/ModelConfigTab';
import { QiLogsTab } from './components/QiLogsTab';

const SETTINGS_TABS = [
  { label: '游戏设置', value: 'game' },
  { label: '天地灵气', value: 'qi' },
  { label: '账号管理', value: 'account' },
  { label: '模型配置', value: 'llm' },
  { label: '连接状态', value: 'connection' },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]['value'];

function isSettingsTab(value: string | null): value is SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.value === value);
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    return isSettingsTab(tab) ? tab : 'game';
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setSearchParams(value === 'game' ? {} : { tab: value }, { replace: true });
  };

  return (
    <GameSceneFrame
      variant="workflow"
      title="系统设置"
      description="集中管理当前角色、账号维护与本地模型配置。"
      aside={
        <>
          <GameSceneAsideSection title="当前页">
            <p className="text-ink-secondary text-sm leading-7">
              设置项只影响当前登录账号与当前浏览器内的本地配置。
            </p>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="模型配置">
            <p className="text-ink-secondary text-sm leading-7">
              API Key 仍仅保存在浏览器 localStorage，不会持久化到服务器。
            </p>
          </GameSceneAsideSection>
        </>
      }
    >
      <GameSceneTabs
        items={SETTINGS_TABS.map((tab) => ({
          label: tab.label,
          value: tab.value,
        }))}
        activeValue={activeTab}
        onChange={handleTabChange}
      />

      <div className="pt-2">
        {activeTab === 'game' ? <GameSettingsTab /> : null}
        {activeTab === 'qi' ? <QiLogsTab /> : null}
        {activeTab === 'account' ? <AccountSettingsTab /> : null}
        {activeTab === 'llm' ? <ModelConfigTab /> : null}
        {activeTab === 'connection' ? <ConnectionStatusTab /> : null}
      </div>
    </GameSceneFrame>
  );
}

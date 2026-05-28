import { useInkUI } from '@app/components/providers/InkUIProvider';
import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_GROUP_NUMBER = '1107586928';

type CommunityGroupState = {
  groupNumber?: string;
  joinHint?: string;
  error?: string;
};

export default function CommunityPage() {
  const { pushToast } = useInkUI();
  const [groupNumber, setGroupNumber] = useState(DEFAULT_GROUP_NUMBER);
  const [joinHint, setJoinHint] = useState('请复制群号后前往 QQ 搜索并申请加群');

  const loadGroupNumber = useCallback(async () => {
    const response = await fetch('/api/community/qq-group');
    const data = (await response.json()) as CommunityGroupState;
    if (!response.ok) {
      throw new Error(data.error ?? '加载 QQ 群号失败');
    }
    setGroupNumber(data.groupNumber?.trim() || DEFAULT_GROUP_NUMBER);
    setJoinHint(data.joinHint?.trim() || '请复制群号后前往 QQ 搜索并申请加群');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGroupNumber();
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '加载 QQ 群号失败',
            tone: 'warning',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadGroupNumber, pushToast]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(groupNumber);
      pushToast({ message: 'QQ 群号已复制', tone: 'success' });
    } catch {
      pushToast({ message: '复制失败，请手动记下群号', tone: 'warning' });
    }
  }, [groupNumber, pushToast]);

  return (
    <GameSceneFrame
      variant="lite"
      title="玩家交流群"
      description="与道友同修，共论仙途。这里收束了当前 QQ 社群入口与加群提醒，方便离开洞府后继续论道。"
      aside={
        <GameSceneAsideSection title="入群提醒" className="text-sm leading-7">
          <p>复制群号后，可在 QQ 内直接搜索群号申请入群。</p>
          <p className="mt-2">若管理员调整官方群号，此页会同步展示最新配置。</p>
        </GameSceneAsideSection>
      }
    >
      <div className="space-y-4">
        <div className="border-ink/20 bg-paper mx-auto max-w-sm border border-dashed p-6 text-center">
          <p className="text-ink-secondary text-xs tracking-[0.18em]">QQ 交流群号</p>
          <p className="text-ink mt-3 text-3xl tracking-[0.22em]">{groupNumber}</p>
          <p className="text-ink-secondary mt-4 text-sm leading-7">{joinHint}</p>
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <InkButton variant="primary" onClick={() => void handleCopy()}>
            复制群号
          </InkButton>
        </div>
      </div>
    </GameSceneFrame>
  );
}

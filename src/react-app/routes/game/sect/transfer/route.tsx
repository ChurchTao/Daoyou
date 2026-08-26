import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneSection,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge, InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import { CHEAT_HEAVEN_TALISMAN_NAME } from '@shared/config/sectTransferTalisman';
import type { SectTransferPreviewData } from '@shared/contracts/sect';
import { SECT_RANK_LABELS } from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

async function fetchPreview(targetSectId: string, reversePaths: boolean) {
  const query = new URLSearchParams({
    targetSectId,
    reversePaths: String(reversePaths),
  });
  const response = await fetch(`/api/sects/current/transfer/preview?${query}`);
  const json = (await response.json()) as
    | { success: true; data: SectTransferPreviewData }
    | { success: false; error: string };
  if (!response.ok || !json.success)
    throw new Error('error' in json ? json.error : '转宗预览读取失败');
  return json.data;
}

export default function SectTransferPage() {
  const session = usePlayerSession();
  const currentSectId = session.data?.activeCultivator?.sectId;
  const targets = useMemo(
    () =>
      productionSectRuntime.registry
        .listDefinitions()
        .filter((definition) => definition.id !== currentSectId),
    [currentSectId],
  );
  const [targetSectId, setTargetSectId] = useState('');
  const [reversePaths, setReversePaths] = useState(false);
  const [preview, setPreview] = useState<SectTransferPreviewData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const previewRequestRef = useRef(0);
  const { mutate } = useResourceMutation();
  const { openDialog, pushToast } = useInkUI();
  const navigate = useNavigate();

  const loadPreview = async (
    nextTargetSectId: string,
    nextReverse: boolean,
  ) => {
    const request = previewRequestRef.current + 1;
    previewRequestRef.current = request;
    setLoading(true);
    setError(undefined);
    await fetchPreview(nextTargetSectId, nextReverse)
      .then((data) => {
        if (previewRequestRef.current === request) setPreview(data);
      })
      .catch((reason) => {
        if (previewRequestRef.current === request)
          setError(reason instanceof Error ? reason.message : '转宗预览失败');
      })
      .finally(() => {
        if (previewRequestRef.current === request) setLoading(false);
      });
  };

  if (session.loading) return <GameSceneLoading message="正在读取宗门信息……" />;
  if (!currentSectId)
    return (
      <GameSceneFrame
        title="欺天台 · 转宗"
        description="尚未拜入宗门，暂时不能使用欺天符。"
      >
        <InkButton href="/game/sect/onboarding">前往诸宗山门</InkButton>
      </GameSceneFrame>
    );

  const transfer = async () => {
    if (!preview?.talisman.id || transferring) return;
    setTransferring(true);
    try {
      await mutate(
        fetch('/api/sects/current/transfer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            targetSectId,
            reversePaths,
            consumableId: preview.talisman.id,
          }),
        }),
      );
      pushToast({
        message: `转宗成功，你现在已加入${preview.target.name}`,
        tone: 'success',
      });
      navigate(
        `/game/sect/onboarding?sectId=${encodeURIComponent(preview.target.sectId)}&entry=transfer`,
        { replace: true },
      );
    } catch (reason) {
      pushToast({
        message: reason instanceof Error ? reason.message : '转宗失败',
        tone: 'danger',
      });
    } finally {
      setTransferring(false);
    }
  };

  const confirmTransfer = () => {
    if (!preview) return;
    openDialog({
      title: `启封${CHEAT_HEAVEN_TALISMAN_NAME}`,
      content: (
        <div className="space-y-3 py-2 text-sm leading-7">
          <p className="text-center">
            确认使用<strong>{CHEAT_HEAVEN_TALISMAN_NAME}</strong>，从
            <strong>{preview.source.name}</strong>转入
            <strong>{preview.target.name}</strong>？
          </p>
          <p className="text-ink-secondary text-center">
            心法等级、流派解锁层数、弟子身份和贡献都会保留。转入新宗门后，需要重新选择流派节点和宗门神通；原宗门职务不会保留。
          </p>
          {preview.activeTaskCount > 0 && (
            <p className="text-crimson text-center">
              {preview.activeTaskCount}
              项进行中的宗门任务将自动放弃，请确认没有遗漏。
            </p>
          )}
        </div>
      ),
      confirmLabel: '确认转入新宗门',
      cancelLabel: '再想想',
      loadingLabel: '正在完成转宗……',
      onConfirm: transfer,
    });
  };

  return (
    <GameSceneFrame
      title="欺天台 · 转宗"
      description="欺天符可以让你无损转入另一个宗门。请先查看转宗后的变化，确认成功后才会消耗符箓。"
    >
      <GameSceneSection title="选择目标宗门">
        <div className="grid gap-3 md:grid-cols-2">
          {targets.map((sect) => (
            <InkCard key={sect.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <strong>{sect.name}</strong>
                {sect.id === 'jiujie' && (
                  <InkBadge tone="accent">新宗门</InkBadge>
                )}
              </div>
              <p className="text-ink-secondary text-sm leading-6">
                {sect.description}
              </p>
              <InkButton
                variant={targetSectId === sect.id ? 'primary' : 'secondary'}
                onClick={() => {
                  setTargetSectId(sect.id);
                  setReversePaths(false);
                  void loadPreview(sect.id, false);
                }}
              >
                {targetSectId === sect.id ? '已选择' : '选择此宗'}
              </InkButton>
            </InkCard>
          ))}
        </div>
      </GameSceneSection>

      {loading && <GameSceneLoading message="正在计算转宗后的保留内容……" />}
      {error && <InkNotice tone="danger">{error}</InkNotice>}
      {preview && !loading && (
        <>
          <GameSceneSection title="转宗后的变化">
            <div className="grid gap-3 sm:grid-cols-3">
              <InkCard>
                <p className="text-ink-secondary text-xs">弟子身份</p>
                <p className="mt-2 font-semibold">
                  {SECT_RANK_LABELS[preview.discipleRank]}
                </p>
              </InkCard>
              <InkCard>
                <p className="text-ink-secondary text-xs">当前贡献</p>
                <p className="mt-2 font-semibold">
                  {preview.contribution.toLocaleString('zh-CN')}
                </p>
              </InkCard>
              <InkCard>
                <p className="text-ink-secondary text-xs">历史总贡献</p>
                <p className="mt-2 font-semibold">
                  {preview.lifetimeContribution.toLocaleString('zh-CN')}
                </p>
              </InkCard>
            </div>
          </GameSceneSection>

          <GameSceneSection title="心法等级保留">
            <div className="space-y-2 text-sm">
              {preview.methodMappings.map((mapping) => (
                <div
                  key={mapping.sourceMethodId}
                  className="border-ink/10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b py-2"
                >
                  <span>{mapping.sourceMethodName}</span>
                  <span className="text-ink-secondary">
                    Lv.{mapping.level} →
                  </span>
                  <span className="text-right">{mapping.targetMethodName}</span>
                </div>
              ))}
            </div>
          </GameSceneSection>

          <GameSceneSection
            title="流派进度保留"
            actions={
              <InkButton
                variant="secondary"
                onClick={() => {
                  const next = !reversePaths;
                  setReversePaths(next);
                  void loadPreview(targetSectId, next);
                }}
              >
                交换两条流派对应
              </InkButton>
            }
          >
            <p className="text-ink-secondary mb-3 text-sm leading-6">
              默认按顺序对应两条流派；如果想交换对应关系，可点击右上角按钮查看另一种结果。
            </p>
            <div className="space-y-3">
              {preview.pathMappings.map((mapping) => (
                <InkCard key={mapping.sourcePathId}>
                  <p>
                    {mapping.sourcePathName} → {mapping.targetPathName}
                  </p>
                  <p className="text-ink-secondary mt-1 text-sm">
                    转宗后保留已解锁{mapping.unlockedLayerCount}层
                    {mapping.active ? ' · 转宗后默认使用' : ''}
                  </p>
                </InkCard>
              ))}
            </div>
          </GameSceneSection>

          <GameSceneSection title="落印前须知">
            <ul className="space-y-2 text-sm leading-6">
              {preview.warnings.map((warning) => (
                <li key={warning}>· {warning}</li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end">
              <InkButton
                variant="primary"
                disabled={
                  !preview.talisman.available ||
                  preview.hasClaimableTasks ||
                  transferring
                }
                pending={transferring}
                pendingLabel="正在完成转宗……"
                onClick={confirmTransfer}
              >
                {preview.talisman.available
                  ? preview.hasClaimableTasks
                    ? '请先领取任务奖励'
                    : `使用${CHEAT_HEAVEN_TALISMAN_NAME}`
                  : `缺少${CHEAT_HEAVEN_TALISMAN_NAME}`}
              </InkButton>
            </div>
          </GameSceneSection>
        </>
      )}
    </GameSceneFrame>
  );
}

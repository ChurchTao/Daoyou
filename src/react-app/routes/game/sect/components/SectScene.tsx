/* eslint-disable react-refresh/only-export-components -- scene components and their tightly coupled hooks share one private module */
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { fetchSectCurrent } from '@app/lib/sect/sectClient';
import type { SectCurrentData } from '@shared/contracts/sect';
import { SECT_RANK_LABELS, type SectDiscipleRank } from '@shared/engine/sect';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

export type SectSceneMood =
  | 'hall'
  | 'affairs'
  | 'archive'
  | 'cliff'
  | 'arena'
  | 'treasury'
  | 'industries'
  | 'cultivation'
  | 'alchemy'
  | 'refinery'
  | 'vein'
  | 'garden'
  | 'cave'
  | 'gate';

const moodStyles: Record<SectSceneMood, { surface: string; emblem: string }> = {
  hall: { surface: 'border-amber-900/20 bg-[radial-gradient(circle_at_50%_0%,rgba(146,83,37,0.18),transparent_44%),linear-gradient(180deg,rgba(250,244,224,0.92),rgba(242,229,199,0.5))]', emblem: '殿' },
  affairs: { surface: 'border-stone-700/20 bg-[linear-gradient(110deg,rgba(101,68,43,0.12),transparent_35%),repeating-linear-gradient(90deg,rgba(255,255,255,0.3)_0_1px,transparent_1px_72px)]', emblem: '令' },
  archive: { surface: 'border-amber-800/20 bg-[radial-gradient(circle_at_18%_18%,rgba(173,126,50,0.18),transparent_32%),linear-gradient(135deg,rgba(248,240,215,0.95),rgba(229,211,169,0.55))]', emblem: '经' },
  cliff: { surface: 'border-sky-900/15 bg-[radial-gradient(circle_at_72%_8%,rgba(255,255,255,0.9),transparent_28%),linear-gradient(155deg,rgba(218,233,226,0.85),rgba(237,230,207,0.65))]', emblem: '悟' },
  arena: { surface: 'border-red-900/20 bg-[radial-gradient(circle_at_50%_45%,transparent_0_19%,rgba(113,31,31,0.08)_20%_21%,transparent_22%_34%,rgba(113,31,31,0.07)_35%_36%,transparent_37%),linear-gradient(180deg,rgba(231,221,204,0.9),rgba(210,197,177,0.62))]', emblem: '武' },
  treasury: { surface: 'border-yellow-900/20 bg-[linear-gradient(135deg,rgba(147,104,30,0.16),transparent_42%),repeating-linear-gradient(0deg,rgba(93,63,25,0.06)_0_2px,transparent_2px_62px)]', emblem: '藏' },
  industries: { surface: 'border-slate-800/20 bg-[linear-gradient(120deg,rgba(73,84,83,0.1),transparent_45%),repeating-linear-gradient(45deg,rgba(60,70,66,0.045)_0_1px,transparent_1px_18px)]', emblem: '造' },
  cultivation: { surface: 'border-teal-900/20 bg-[radial-gradient(circle_at_50%_44%,rgba(121,190,177,0.2)_0_9%,transparent_10%_20%,rgba(66,117,111,0.09)_21%_22%,transparent_23%),linear-gradient(180deg,rgba(225,237,224,0.9),rgba(226,216,192,0.55))]', emblem: '静' },
  alchemy: { surface: 'border-orange-950/20 bg-[radial-gradient(circle_at_50%_85%,rgba(197,71,20,0.22),transparent_28%),linear-gradient(145deg,rgba(244,226,190,0.92),rgba(202,171,124,0.48))]', emblem: '丹' },
  refinery: { surface: 'border-slate-950/25 bg-[linear-gradient(135deg,rgba(56,63,66,0.18),transparent_45%),radial-gradient(circle_at_78%_74%,rgba(182,73,30,0.16),transparent_24%)]', emblem: '器' },
  vein: { surface: 'border-cyan-950/20 bg-[linear-gradient(125deg,transparent_28%,rgba(79,176,184,0.16)_29%_31%,transparent_32%_54%,rgba(61,144,153,0.12)_55%_57%,transparent_58%),linear-gradient(180deg,rgba(213,226,218,0.86),rgba(191,199,185,0.58))]', emblem: '脉' },
  garden: { surface: 'border-emerald-950/20 bg-[repeating-linear-gradient(165deg,rgba(53,111,70,0.08)_0_2px,transparent_2px_34px),linear-gradient(135deg,rgba(218,232,201,0.9),rgba(235,220,179,0.55))]', emblem: '药' },
  cave: { surface: 'border-stone-800/20 bg-[radial-gradient(ellipse_at_30%_25%,rgba(255,255,255,0.65),transparent_28%),linear-gradient(140deg,rgba(212,214,202,0.9),rgba(181,176,161,0.55))]', emblem: '隐' },
  gate: { surface: 'border-sky-950/15 bg-[linear-gradient(180deg,rgba(214,229,226,0.88),rgba(239,227,198,0.6)),repeating-linear-gradient(90deg,transparent_0_80px,rgba(48,72,70,0.05)_80px_81px)]', emblem: '山' },
};

export function useSectCurrentData() {
  const [data, setData] = useState<SectCurrentData>();
  const [error, setError] = useState<string>();
  const reload = useCallback(async () => {
    try {
      setData(await fetchSectCurrent());
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '宗门卷宗读取失败');
    }
  }, []);
  useEffect(() => {
    void fetchSectCurrent().then(setData).catch((reason) => {
      setError(reason instanceof Error ? reason.message : '宗门卷宗读取失败');
    });
  }, []);
  return { data, error, reload, setData };
}

export function useSectMutation(onDone?: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const run = useCallback(
    async <T,>(url: string, init: RequestInit, successMessage: string) => {
      setBusy(true);
      try {
        const result = await mutate<T>(fetch(url, init));
        await onDone?.();
        pushToast({ message: successMessage, tone: 'success' });
        return result;
      } catch (reason) {
        pushToast({
          message: reason instanceof Error ? reason.message : '宗门事务失败',
          tone: 'danger',
        });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [mutate, onDone, pushToast],
  );
  return { busy, run };
}

export function SectScene({
  title,
  description,
  children,
  aside,
  error,
  mood = 'hall',
}: {
  title: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
  error?: string;
  mood?: SectSceneMood;
}) {
  const navigate = useNavigate();
  const atmosphere = moodStyles[mood];
  return (
    <GameSceneFrame
      title={`【${title}】`}
      description={description}
      headerMeta={
        error ? <GameSceneNote tone="danger">{error}</GameSceneNote> : undefined
      }
      aside={aside}
      contentClassName="lg:max-w-none"
    >
      <div className={`relative isolate overflow-hidden border px-4 py-5 sm:px-6 ${atmosphere.surface}`}>
        <span aria-hidden="true" className="text-ink/5 pointer-events-none absolute -top-8 right-4 -z-10 text-[9rem] leading-none select-none sm:text-[13rem]">{atmosphere.emblem}</span>
        <div className="relative mb-5 flex items-center justify-between border-b border-current/10 pb-3">
          <InkButton onClick={() => navigate('/game/sect')} variant="secondary">返回宗门总视图</InkButton>
          <span aria-hidden="true" className="text-ink-secondary/50 text-xs tracking-[0.35em]">凌霄门中</span>
        </div>
        <div className="relative space-y-6">{children}</div>
      </div>
    </GameSceneFrame>
  );
}

export function SectPageLoading({ message = '云雾间卷宗渐次显现……' }: { message?: string }) {
  return <GameSceneLoading message={message} />;
}

export function rankLabel(rank?: SectDiscipleRank) {
  return rank ? SECT_RANK_LABELS[rank] : '未入门';
}

export const postJson = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

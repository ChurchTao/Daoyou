import { InkNotice } from '@app/components/ui';
import { useCombatV6Build } from '@app/lib/resources/player';
import type { CultivatorInspectionData } from '@shared/contracts/player';
import { useEffect, useState } from 'react';
import { CultivatorLoadoutSections } from './CultivatorLoadoutSections';

/** Refresh the public view when the existing build resource changes. */
export function CurrentCultivatorBuild({
  cultivatorId,
}: {
  cultivatorId: string;
}) {
  const source = useCombatV6Build();
  const [data, setData] = useState<CultivatorInspectionData>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!source.data) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/rankings/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetId: cultivatorId }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? '构筑读取失败');
        setData(result.data.cultivator);
        setError('');
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : '构筑读取失败');
      }
    })();
    return () => controller.abort();
  }, [cultivatorId, source.data]);
  if (error || source.error)
    return <InkNotice>{error || source.error}</InkNotice>;
  if (!data) return <InkNotice>正在读取当前构筑…</InkNotice>;
  return <CultivatorLoadoutSections build={data.build} />;
}

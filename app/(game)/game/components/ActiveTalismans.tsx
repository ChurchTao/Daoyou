'use client';

import { InkButton, InkNotice } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCultivator } from '@/lib/contexts/CultivatorContext';

interface TalismanStatus {
  id: string;
  instanceId: string;
  name: string;
  remainingDays: number;
  usesRemaining: number;
  expiresAt: number;
}

export function ActiveTalismans() {
  const [talismans, setTalismans] = useState<TalismanStatus[]>([]);
  const router = useRouter();
  const { cultivator } = useCultivator();

  useEffect(() => {
    const fetchTalismans = async () => {
      try {
        const res = await fetch('/api/cultivator/talismans');
        const data = await res.json();
        if (data.talismans) {
          setTalismans(data.talismans);
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (cultivator) {
      fetchTalismans();
    }
  }, [cultivator]);

  if (talismans.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {talismans.map((talisman) => (
        <InkNotice key={talisman.instanceId} className="flex justify-between items-center">
          <div>
            <span className="font-bold text-ink-primary">{talisman.name}</span>
            <span className="mx-2 text-sm opacity-70">
              道韵尚存 {talisman.remainingDays} 日
            </span>
             {talisman.usesRemaining > 0 && (
                 <span className="text-sm opacity-70">
                   （剩余推演次数：{talisman.usesRemaining}）
                 </span>
             )}
          </div>
          <InkButton
             variant="primary"
             onClick={() => {
                 if (talisman.id === 'reshape_fate_talisman') {
                     router.push('/game/fate-reshape');
                 } else if (talisman.id === 'draw_gongfa_talisman') {
                     router.push('/game/manual-draw?type=gongfa');
                 } else if (talisman.id === 'draw_skill_talisman') {
                     router.push('/game/manual-draw?type=skill');
                 }
             }}
          >
            祭出
          </InkButton>
        </InkNotice>
      ))}
    </div>
  );
}

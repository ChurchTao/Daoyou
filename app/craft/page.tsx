'use client';

import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type CraftType = 'refine' | 'alchemy';

export default function CraftPage() {
  const { cultivator, inventory, refresh } = useCultivatorBundle();
  const [craftType, setCraftType] = useState<CraftType>('refine');
  const [selectedMatIds, setSelectedMatIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isCrafting, setIsCrafting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  const toggleMaterial = (id: string) => {
    if (selectedMatIds.includes(id)) {
      setSelectedMatIds((prev) => prev.filter((mid) => mid !== id));
    } else {
      if (selectedMatIds.length >= 5) {
        pushToast({ message: '最多投入5种材料', tone: 'warning' });
        return;
      }
      setSelectedMatIds((prev) => [...prev, id]);
    }
  };

  const handleCraft = async () => {
    if (!cultivator) return;
    if (selectedMatIds.length === 0) {
      pushToast({ message: '请至少投入一种材料', tone: 'warning' });
      return;
    }
    if (!prompt.trim()) {
      pushToast({ message: '请注入神念（输入提示词）', tone: 'warning' });
      return;
    }

    setIsCrafting(true);
    setResult(null);

    try {
      const res = await fetch('/api/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultivatorId: cultivator.id,
          materialIds: selectedMatIds,
          prompt,
          craftType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
        pushToast({ message: '炼制成功！', tone: 'success' });
        setSelectedMatIds([]);
        setPrompt('');
        await refresh();
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      pushToast({ message: e.message || '炼制失败', tone: 'danger' });
    } finally {
      setIsCrafting(false);
    }
  };

  const availableMaterials = inventory.materials || [];

  return (
    <InkPageShell
      title="【造物仙炉】"
      subtitle="天地为炉，造化为工"
      backHref="/"
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/inventory">查看储物袋</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title="炼制方式">
        <div className="flex gap-4 mb-4 justify-center">
          <button
            onClick={() => setCraftType('refine')}
            className={`px-6 py-2 rounded border ${craftType === 'refine' ? 'bg-ink-primary text-white border-ink-primary' : 'bg-transparent text-ink-secondary border-ink-border'}`}
          >
            炼器 (法宝)
          </button>
          <button
            onClick={() => setCraftType('alchemy')}
            className={`px-6 py-2 rounded border ${craftType === 'alchemy' ? 'bg-ink-primary text-white border-ink-primary' : 'bg-transparent text-ink-secondary border-ink-border'}`}
          >
            炼丹 (丹药)
          </button>
        </div>
      </InkSection>

      {result && (
        <InkSection title="【炼制结果】">
          <div className="bg-ink-bg-2 p-4 rounded text-center border border-ink-primary">
            <div className="text-xl font-bold mb-2 text-ink-primary">
              {result.name}
            </div>
            <div className="text-sm text-ink-secondary mb-2">
              {result.type || result.slot} · {result.rank || '特殊'}
            </div>
            <div className="text-sm mb-4">
              {result.description ||
                JSON.stringify(result.bonus || result.effect)}
            </div>
            <InkButton
              onClick={() => setResult(null)}
              variant="secondary"
              className="w-full"
            >
              收起结果
            </InkButton>
          </div>
        </InkSection>
      )}

      <InkSection title="1. 投入材料 (最多5种)">
        {availableMaterials.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border border-ink-border p-2 rounded">
            {availableMaterials.map((mat) => (
              <div
                key={mat.id}
                onClick={() => toggleMaterial(mat.id!)}
                className={`p-2 rounded cursor-pointer border flex justify-between items-center ${selectedMatIds.includes(mat.id!) ? 'border-ink-primary bg-ink-bg-2' : 'border-ink-border hover:bg-ink-bg-2'}`}
              >
                <span>
                  <InkBadge tier={mat.rank}>{mat.rank}</InkBadge> {mat.name}
                </span>
                {selectedMatIds.includes(mat.id!) && (
                  <span className="text-ink-primary">✔ 已选</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <InkNotice>囊中羞涩，暂无材料。请前往坊市购买。</InkNotice>
        )}
      </InkSection>

      <InkSection title="2. 注入神念">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="在此描述你所求之物的特性、外形或功效..."
          className="w-full h-32 p-3 rounded border border-ink-border bg-ink-bg text-ink-text focus:border-ink-primary outline-none"
        />
      </InkSection>

      <div className="py-4">
        <InkButton
          onClick={handleCraft}
          disabled={isCrafting || selectedMatIds.length === 0}
          variant="primary"
          className="w-full py-4 text-lg"
        >
          {isCrafting
            ? '开炉炼造中...'
            : `开始${craftType === 'refine' ? '炼器' : '炼丹'}`}
        </InkButton>
      </div>
    </InkPageShell>
  );
}

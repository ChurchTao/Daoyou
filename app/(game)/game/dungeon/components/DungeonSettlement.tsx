import { InkPageShell } from '@/components/layout';
import { InkBadge } from '@/components/ui';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { InkTag } from '@/components/ui/InkTag';
import type { ResourceOperation } from '@/engine/resource/types';
import { DungeonSettlement as DungeonSettlementType } from '@/lib/dungeon/types';
import { Quality } from '@/types/constants';
import type { Material } from '@/types/cultivator';
import {
  getMaterialTypeLabel,
  getResourceTypeInfo,
} from '@/types/dictionaries';

interface DisplayMaterial {
  name: string;
  quantity: number;
  rank?: Quality;
  element?: string;
  type?: string;
  description?: string;
}

interface DungeonSettlementProps {
  settlement: DungeonSettlementType | undefined;
  realGains?: ResourceOperation[];
  onConfirm?: () => void;
}

/**
 * 副本结算组件
 * 展示副本探索的最终结果和奖励
 */
export function DungeonSettlement({
  settlement,
  realGains = [],
  onConfirm,
}: DungeonSettlementProps) {
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      // 默认行为：跳转首页
      window.location.href = '/';
    }
  };

  const tier = settlement?.settlement?.reward_tier ?? 'C';
  const tierTheme: Record<string, { title: string; glow: string }> = {
    S: { title: '天命垂青', glow: 'shadow-[0_0_30px_rgba(234,179,8,0.25)]' },
    A: { title: '机缘深厚', glow: 'shadow-[0_0_24px_rgba(34,197,94,0.2)]' },
    B: { title: '收获颇丰', glow: 'shadow-[0_0_24px_rgba(59,130,246,0.2)]' },
    C: { title: '小有所获', glow: 'shadow-[0_0_18px_rgba(120,113,108,0.2)]' },
    D: { title: '险中脱身', glow: 'shadow-[0_0_14px_rgba(239,68,68,0.2)]' },
  };

  const gainByType = realGains.reduce<Record<string, number>>((acc, gain) => {
    acc[gain.type] = (acc[gain.type] || 0) + gain.value;
    return acc;
  }, {});

  const keyResources = [
    'spirit_stones',
    'cultivation_exp',
    'comprehension_insight',
    'lifespan',
  ]
    .map((type) => ({
      type,
      value: gainByType[type] || 0,
      info: getResourceTypeInfo(type),
    }))
    .filter((item) => item.value > 0);

  const materialDrops = realGains
    .filter((gain) => gain.type === 'material')
    .reduce<DisplayMaterial[]>((acc, gain) => {
      const data = (gain.data ?? {}) as Partial<Material>;
      const name = gain.name || data.name || '无名材料';
      const rank = data.rank;
      const element = data.element;
      const type = data.type;
      const quantity = Math.max(1, data.quantity ?? gain.value ?? 1);
      const existing = acc.find(
        (item) =>
          item.name === name &&
          item.rank === rank &&
          item.element === element &&
          item.type === type,
      );

      if (existing) {
        existing.quantity += quantity;
      } else {
        acc.push({
          name,
          quantity,
          rank,
          element,
          type,
          description: data.description,
        });
      }

      return acc;
    }, []);
  const displayedMaterials: DisplayMaterial[] =
    materialDrops.length > 0
      ? materialDrops
      : (settlement?.settlement?.reward_blueprints || [])
          .filter((item) => item.name || item.description)
          .map((item) => ({
            name: item.name || '无名材料',
            quantity: 1,
            rank: undefined,
            element: item.element,
            type: item.material_type,
            description: item.description,
          }));

  return (
    <InkPageShell title="探索结束" backHref="/game">
      <InkCard className="space-y-5 overflow-hidden p-4">
        <div
          className={`border-ink/15 border p-4 ${tierTheme[tier]?.glow || ''}`}
        >
          <div className="text-ink-secondary text-xs tracking-[0.2em]">
            天机判词
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-semibold">
                {tierTheme[tier]?.title}
              </div>
              <div className="text-ink-secondary">
                评价 <span className="text-crimson ml-1 text-3xl">{tier}</span>
              </div>
            </div>
            <div className="mt-2 space-x-1">
              {settlement?.settlement?.performance_tags?.map((tag, idx) => (
                <InkTag key={`${tag}-${idx}`} variant="outline">
                  {tag}
                </InkTag>
              ))}
            </div>
          </div>
        </div>

        <p className="text-ink/80 leading-relaxed">
          {settlement?.ending_narrative || '此行尘埃落定，且看所得机缘。'}
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {keyResources.length > 0 ? (
            keyResources.map((gain) => (
              <div
                key={gain.type}
                className="bg-ink/5 border-ink/10 border px-3 py-2"
              >
                <div className="text-ink-secondary text-xs">
                  {gain.info.label}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {gain.info.icon} +{gain.value.toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <div className="text-ink-secondary bg-ink/5 border-ink/15 border border-dashed px-3 py-4 text-sm sm:col-span-2">
              此行未见修为精进
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">机缘灵材</div>
          {displayedMaterials.length > 0 ? (
            <div className="space-y-2">
              {displayedMaterials.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  className="bg-ink/5 border-ink/10 border px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-ink-secondary mt-1 text-xs">
                        {[item.element ? `五行：${item.element}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {item.rank ? (
                        <InkBadge tier={item.rank as Quality}>
                          {getMaterialTypeLabel(item.type as Material['type'])}
                        </InkBadge>
                      ) : (
                        <span className="text-ink-secondary border-ink/20 border px-2 py-0.5 text-xs font-medium">
                          未鉴品
                        </span>
                      )}
                      <span className="text-crimson text-sm font-semibold">
                        数量 x{item.quantity}
                      </span>
                    </div>
                  </div>
                  <div className="text-ink-secondary mt-2 text-xs leading-relaxed">
                    描述：{item.description || '此物灵机晦暗，暂难窥其全貌。'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-ink-secondary bg-ink/5 border-ink/15 border border-dashed px-3 py-4 text-sm">
              此行机缘浅薄，未得可携灵材
            </div>
          )}
        </div>

        <InkButton
          onClick={handleConfirm}
          variant="primary"
          className="mt-4 block w-full text-center"
        >
          收入囊中
        </InkButton>
      </InkCard>
    </InkPageShell>
  );
}

import { getPillFamilyLabel } from '@app/components/feature/consumables';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import {
  InkBadge,
  InkButton,
  InkDetailDrawer,
  InkNotice,
  inkFieldVariants,
} from '@app/components/ui';
import { formatAlchemyPropertyVector } from '@shared/lib/alchemyProperties';
import {
  PILL_FAMILY_VALUES,
  type AlchemyFormula,
  type PillFamily,
} from '@shared/types/consumable';
import { useAlchemyFormulaLibrary } from './useAlchemyFormulaLibrary';

export function FormulaPickerModal({
  isOpen,
  selectedId,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  selectedId?: string;
  onClose(): void;
  onSelect(formula: AlchemyFormula): void;
}) {
  const library = useAlchemyFormulaLibrary({ enabled: isOpen, pageSize: 5 });

  return (
    <InkDetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="选择本炉丹方"
      description="查看丹药用途、材料要求和熟练度，点击一行即可选择。"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-secondary text-xs">
            {selectedId ? '已为本炉选择丹方' : '尚未选择丹方'}
          </span>
          <InkButton variant="secondary" onClick={onClose}>
            关闭
          </InkButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <input
            className={inkFieldVariants()}
            value={library.search}
            placeholder="搜索丹方名称"
            onChange={(event) => library.setSearch(event.target.value)}
          />
          <select
            className={inkFieldVariants()}
            value={library.family}
            aria-label="按丹药用途筛选"
            onChange={(event) =>
              library.setFamily(event.target.value as PillFamily | 'all')
            }
          >
            <option value="all">全部用途</option>
            {PILL_FAMILY_VALUES.map((family) => (
              <option key={family} value={family}>
                {getPillFamilyLabel(family)}
              </option>
            ))}
          </select>
        </div>

        {library.error ? (
          <InkNotice tone="warning">{library.error}</InkNotice>
        ) : null}

        {library.loading && library.formulas.length === 0 ? (
          <GameLoadingState
            variant="inline"
            message="正在读取丹方……"
          />
        ) : null}

        {library.formulas.length ? (
          <div className="space-y-2">
            {library.formulas.map((formula) => {
              const selected = selectedId === formula.id;
              const propertyText = formatAlchemyPropertyVector(
                formula.pattern.targetPropertyVector,
              );

              return (
                <button
                  key={formula.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onSelect(formula);
                    onClose();
                  }}
                  className={`w-full border px-4 py-3 text-left transition-colors ${
                    selected
                      ? 'border-crimson bg-crimson/[0.045]'
                      : 'border-ink/15 hover:border-crimson/40 hover:bg-ink/[0.02]'
                  }`}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="truncate text-base">
                          {formula.name}
                        </strong>
                        <InkBadge tone="default" compact>
                          {getPillFamilyLabel(formula.family)}
                        </InkBadge>
                      </span>
                      <span className="text-ink-secondary mt-1 line-clamp-2 block text-xs leading-5">
                        {formula.description || '暂无丹方说明。'}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs ${selected ? 'text-crimson font-semibold' : 'text-ink-secondary'}`}
                    >
                      {selected ? '当前选择' : '选择'}
                    </span>
                  </span>

                  <span className="border-ink/10 mt-3 grid gap-x-3 gap-y-2 border-t border-dashed pt-3 text-xs sm:grid-cols-3">
                    <FormulaFact
                      label="材料数量"
                      value={`${formula.pattern.slotCount} 味`}
                    />
                    <FormulaFact
                      label="最低品质"
                      value={formula.pattern.minQuality ?? '不限'}
                    />
                    <FormulaFact
                      label="熟练度"
                      value={`Lv.${formula.mastery.level}`}
                    />
                    <span className="sm:col-span-3">
                      <span className="text-ink-secondary">药效方向：</span>
                      <span>{propertyText || '未记录'}</span>
                      {formula.pattern.dominantElement ? (
                        <span className="text-ink-secondary ml-2">
                          · 主要属性：{formula.pattern.dominantElement}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : !library.loading ? (
          <InkNotice>暂无符合条件的丹方。</InkNotice>
        ) : null}

        <div className="flex items-center justify-between">
          <InkButton
            variant="secondary"
            disabled={!library.pagination.hasPreviousPage || library.loading}
            onClick={() => library.setPage(library.page - 1)}
          >
            上一页
          </InkButton>
          <span className="text-ink-secondary text-xs">
            第 {library.pagination.page} /{' '}
            {Math.max(1, library.pagination.totalPages)} 页
          </span>
          <InkButton
            variant="secondary"
            disabled={!library.pagination.hasNextPage || library.loading}
            onClick={() => library.setPage(library.page + 1)}
          >
            下一页
          </InkButton>
        </div>
      </div>
    </InkDetailDrawer>
  );
}

function FormulaFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline justify-between gap-2 sm:block">
      <span className="text-ink-secondary">{label}</span>
      <strong className="font-medium sm:ml-2">{value}</strong>
    </span>
  );
}

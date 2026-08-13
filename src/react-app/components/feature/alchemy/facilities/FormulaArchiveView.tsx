import { getPillFamilyLabel } from '@app/components/feature/consumables';
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
import { useState } from 'react';
import { AlchemyToolWorkspace } from '../AlchemyToolWorkspace';
import { useAlchemyCraftSession } from '../alchemyCraftContext';
import { useAlchemyFormulaLibrary } from '../useAlchemyFormulaLibrary';

export function FormulaArchiveView({
  onBack,
  onOpenFurnace,
}: {
  onBack(): void;
  onOpenFurnace(): void;
}) {
  const session = useAlchemyCraftSession();
  const library = useAlchemyFormulaLibrary();
  const [detail, setDetail] = useState<AlchemyFormula | null>(null);
  const openFurnace = (formula: AlchemyFormula) => {
    session.selectFormula(formula);
    onOpenFurnace();
  };
  return (
    <AlchemyToolWorkspace
      title="查看已有丹方"
      backLabel="丹方玉简"
      onBack={onBack}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
          <input
            className={inkFieldVariants()}
            value={library.search}
            placeholder="以丹方名检索玉简"
            onChange={(event) => library.setSearch(event.target.value)}
          />
          <select
            className={inkFieldVariants()}
            value={library.family}
            onChange={(event) =>
              library.setFamily(event.target.value as PillFamily | 'all')
            }
          >
            <option value="all">全部丹类</option>
            {PILL_FAMILY_VALUES.map((family) => (
              <option key={family} value={family}>
                {getPillFamilyLabel(family)}
              </option>
            ))}
          </select>
          <InkButton
            variant="secondary"
            pending={library.loading}
            onClick={library.reload}
          >
            刷新
          </InkButton>
        </div>

        {library.error ? (
          <InkNotice tone="warning">{library.error}</InkNotice>
        ) : null}

        {library.formulas.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {library.formulas.map((formula) => {
              const propertyText = formatAlchemyPropertyVector(
                formula.pattern.targetPropertyVector,
              );
              return (
                <article
                  key={formula.id}
                  className="border-ink/15 bg-ink/[0.012] flex min-w-0 flex-col border p-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="truncate text-base font-medium">
                          {formula.name}
                        </strong>
                        <InkBadge compact>
                          {getPillFamilyLabel(formula.family)}
                        </InkBadge>
                      </div>
                      <p className="text-ink-secondary mt-1 line-clamp-2 text-xs leading-5">
                        {formula.description || '暂无丹方说明。'}
                      </p>
                    </div>
                  </div>

                  <FormulaFacts formula={formula} propertyText={propertyText} />

                  <div className="border-ink/10 mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                    <InkButton
                      variant="secondary"
                      onClick={() => setDetail(formula)}
                    >
                      查看详情
                    </InkButton>
                    <InkButton
                      variant="secondary"
                      onClick={() => library.deleteFormula(formula)}
                    >
                      删除
                    </InkButton>
                    <InkButton
                      variant="primary"
                      onClick={() => openFurnace(formula)}
                    >
                      使用此丹方
                    </InkButton>
                  </div>
                </article>
              );
            })}
          </div>
        ) : !library.loading ? (
          <InkNotice tone="info">
            尚未留存丹方。可在丹炉选择随心炼丹，成功后有机会悟得新方。
          </InkNotice>
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
            {library.pagination.page} /{' '}
            {Math.max(1, library.pagination.totalPages)}
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

      <FormulaDetailDrawer
        formula={detail}
        onClose={() => setDetail(null)}
        onUse={openFurnace}
        onDelete={(formula) => {
          setDetail(null);
          library.deleteFormula(formula);
        }}
      />
    </AlchemyToolWorkspace>
  );
}

function FormulaFacts({
  formula,
  propertyText,
}: {
  formula: AlchemyFormula;
  propertyText: string;
}) {
  return (
    <div className="border-ink/10 mt-3 grid gap-x-3 gap-y-2 border-t border-dashed pt-3 text-xs sm:grid-cols-3">
      <FormulaFact label="材料数量" value={`${formula.pattern.slotCount} 味`} />
      <FormulaFact
        label="最低品质"
        value={formula.pattern.minQuality ?? '不限'}
      />
      <FormulaFact label="熟练度" value={`Lv.${formula.mastery.level}`} />
      <p className="leading-5 sm:col-span-3">
        <span className="text-ink-secondary">药效方向：</span>
        <span>{propertyText || '未记录'}</span>
        {formula.pattern.dominantElement ? (
          <span className="text-ink-secondary ml-2">
            · 主要属性：{formula.pattern.dominantElement}
          </span>
        ) : null}
      </p>
    </div>
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

function FormulaDetailDrawer({
  formula,
  onClose,
  onUse,
  onDelete,
}: {
  formula: AlchemyFormula | null;
  onClose(): void;
  onUse(formula: AlchemyFormula): void;
  onDelete(formula: AlchemyFormula): void;
}) {
  const propertyText = formula
    ? formatAlchemyPropertyVector(formula.pattern.targetPropertyVector)
    : '';
  return (
    <InkDetailDrawer
      isOpen={Boolean(formula)}
      onClose={onClose}
      title={formula?.name ?? '丹方详情'}
      description="查看这份丹方的用途、材料要求和药效方向。"
      size="md"
      footer={
        formula ? (
          <div className="flex flex-wrap justify-end gap-2">
            <InkButton variant="secondary" onClick={() => onDelete(formula)}>
              删除丹方
            </InkButton>
            <InkButton variant="primary" onClick={() => onUse(formula)}>
              使用此丹方
            </InkButton>
          </div>
        ) : null
      }
    >
      {formula ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <InkBadge>{getPillFamilyLabel(formula.family)}</InkBadge>
          </div>
          <p className="text-ink-secondary text-sm leading-7">
            {formula.description || '这份丹方暂未留下更多说明。'}
          </p>
          <FormulaFacts formula={formula} propertyText={propertyText} />
        </div>
      ) : null}
    </InkDetailDrawer>
  );
}

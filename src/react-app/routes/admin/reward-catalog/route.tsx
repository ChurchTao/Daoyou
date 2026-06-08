import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import {
  applyTalismanQuickPreset,
  getAlchemySourceAlias,
  getDraftMeta,
  getDurationKindAlias,
  getEquipmentSlotAlias,
  getMaterialTypeAlias,
  getOperationTypeAlias,
  getPillFamilyAlias,
  getPillQuotaCategoryAlias,
  getProgressTargetAlias,
  getResourceAlias,
  getRestoreModeAlias,
  getSpecKindLabel,
  getStatusAlias,
  getTalismanScenarioAlias,
  getTalismanSessionModeAlias,
  getTrackAlias,
  TALISMAN_QUICK_PRESETS,
} from './catalogPresentation';
import {
  CONSUMABLE_TYPE_VALUES,
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
} from '@shared/types/constants';
import {
  PILL_FAMILY_VALUES,
  PILL_QUOTA_CATEGORY_VALUES,
  TALISMAN_SESSION_MODE_VALUES,
} from '@shared/types/consumable';
import type { RewardCatalogItem } from '@shared/lib/rewardCatalog';
import { useEffect, useState } from 'react';
import {
  CONDITION_STATUS_KEY_OPTIONS,
  CONDITION_TRACK_PATH_OPTIONS,
  createEmptyDraftItem,
  createEmptyOperationDraft,
  createDefaultPillDraft,
  createDefaultTalismanDraft,
  rewardCatalogDraftToItem,
  rewardCatalogItemToDraft,
  type ConsumablePillDraft,
  type ConsumableTalismanDraft,
  type DraftOperationType,
  type PillOperationDraft,
  type RewardCatalogDraftItem,
} from './catalogDraft';

interface RewardCatalogResponse {
  catalog?: RewardCatalogItem[];
  error?: string;
}

function getTypeLabel(type: RewardCatalogDraftItem['type']) {
  switch (type) {
    case 'material':
      return '材料';
    case 'consumable':
      return '消耗品';
    case 'artifact':
      return '法宝';
  }
}

function OperationEditor({
  operation,
  onChange,
  onRemove,
}: {
  operation: PillOperationDraft;
  onChange: (nextOperation: PillOperationDraft) => void;
  onRemove: () => void;
}) {
  const setField = <K extends keyof PillOperationDraft>(
    key: K,
    value: PillOperationDraft[K],
  ) => {
    onChange({
      ...operation,
      [key]: value,
    });
  };

  return (
    <div className="border-ink/12 bg-paper/80 space-y-3 border border-dashed p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <InkSelect
          label="效果类型"
          value={operation.type}
          onChange={(value) =>
            onChange(createEmptyOperationDraft(value as DraftOperationType))
          }
        >
          <option value="restore_resource">
            {getOperationTypeAlias('restore_resource')}
          </option>
          <option value="change_gauge">
            {getOperationTypeAlias('change_gauge')}
          </option>
          <option value="remove_status">
            {getOperationTypeAlias('remove_status')}
          </option>
          <option value="add_status">
            {getOperationTypeAlias('add_status')}
          </option>
          <option value="advance_track">
            {getOperationTypeAlias('advance_track')}
          </option>
          <option value="gain_progress">
            {getOperationTypeAlias('gain_progress')}
          </option>
          <option value="increase_lifespan">
            {getOperationTypeAlias('increase_lifespan')}
          </option>
        </InkSelect>

        {operation.type === 'restore_resource' ? (
          <>
            <InkSelect
              label="资源"
              value={operation.resource}
              onChange={(value) => setField('resource', value as 'hp' | 'mp')}
            >
              <option value="hp">{getResourceAlias('hp')}</option>
              <option value="mp">{getResourceAlias('mp')}</option>
            </InkSelect>
            <InkSelect
              label="模式"
              value={operation.mode}
              onChange={(value) =>
                setField('mode', value as 'flat' | 'percent')
              }
            >
              <option value="flat">{getRestoreModeAlias('flat')}</option>
              <option value="percent">{getRestoreModeAlias('percent')}</option>
            </InkSelect>
            <InkInput
              label="数值"
              value={operation.value}
              onChange={(value) => setField('value', value)}
              placeholder="例如：100"
            />
          </>
        ) : null}

        {operation.type === 'change_gauge' ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-ink font-semibold tracking-[0.08em]">
                目标槽位
              </span>
              <div className="border-ink/15 bg-bgpaper/70 text-ink rounded-sm border border-dashed px-3 py-2">
                丹毒
              </div>
            </div>
            <InkInput
              label="变化值"
              value={operation.delta}
              onChange={(value) => setField('delta', value)}
              placeholder="例如：-10"
            />
          </>
        ) : null}

        {operation.type === 'remove_status' ? (
          <>
            <InkSelect
              label="状态"
              value={operation.status}
              onChange={(value) => setField('status', value)}
            >
              {CONDITION_STATUS_KEY_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getStatusAlias(status)}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="移除全部"
              value={operation.removeAll}
              onChange={(value) => setField('removeAll', value as 'false' | 'true')}
            >
              <option value="false">否</option>
              <option value="true">是</option>
            </InkSelect>
          </>
        ) : null}

        {operation.type === 'add_status' ? (
          <>
            <InkSelect
              label="状态"
              value={operation.status}
              onChange={(value) => setField('status', value)}
            >
              {CONDITION_STATUS_KEY_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getStatusAlias(status)}
                </option>
              ))}
            </InkSelect>
            <InkInput
              label="层数（可选）"
              value={operation.stacks}
              onChange={(value) => setField('stacks', value)}
              placeholder="例如：2"
            />
            <InkSelect
              label="持续时间"
              value={operation.durationKind}
              onChange={(value) =>
                setField(
                  'durationKind',
                  value as '' | 'until_removed' | 'time',
                )
              }
            >
              <option value="">{getDurationKindAlias('')}</option>
              <option value="until_removed">
                {getDurationKindAlias('until_removed')}
              </option>
              <option value="time">{getDurationKindAlias('time')}</option>
            </InkSelect>
            {operation.durationKind === 'time' ? (
              <InkInput
                label="过期时间（ISO）"
                value={operation.expiresAt}
                onChange={(value) => setField('expiresAt', value)}
                placeholder="例如：2026-06-01T12:00:00.000Z"
              />
            ) : null}
            <InkInput
              label="剩余次数（可选）"
              value={operation.usesRemaining}
              onChange={(value) => setField('usesRemaining', value)}
              placeholder="例如：1"
            />
            <InkInput
              label="状态载荷（可选 JSON）"
              value={operation.payloadText}
              onChange={(value) => setField('payloadText', value)}
              placeholder='例如：{"bonus": 10}'
              multiline
              rows={3}
            />
          </>
        ) : null}

        {operation.type === 'advance_track' ? (
          <>
            <InkSelect
              label="淬体轨道"
              value={operation.track}
              onChange={(value) =>
                setField(
                  'track',
                  value as (typeof CONDITION_TRACK_PATH_OPTIONS)[number],
                )
              }
            >
              {CONDITION_TRACK_PATH_OPTIONS.map((track) => (
                <option key={track} value={track}>
                  {getTrackAlias(track)}
                </option>
              ))}
            </InkSelect>
            <InkInput
              label="推进数值"
              value={operation.value}
              onChange={(value) => setField('value', value)}
              placeholder="例如：10"
            />
          </>
        ) : null}

        {operation.type === 'gain_progress' ? (
          <>
            <InkSelect
              label="进度目标"
              value={operation.target}
              onChange={(value) =>
                setField(
                  'target',
                  value as 'cultivation_exp' | 'comprehension_insight',
                )
              }
            >
              <option value="cultivation_exp">
                {getProgressTargetAlias('cultivation_exp')}
              </option>
              <option value="comprehension_insight">
                {getProgressTargetAlias('comprehension_insight')}
              </option>
            </InkSelect>
            <InkInput
              label="增加数值"
              value={operation.value}
              onChange={(value) => setField('value', value)}
              placeholder="例如：120"
            />
          </>
        ) : null}

        {operation.type === 'increase_lifespan' ? (
          <InkInput
            label="寿元年数"
            value={operation.value}
            onChange={(value) => setField('value', value)}
            placeholder="例如：60"
          />
        ) : null}
      </div>

      <div className="flex justify-end">
        <InkButton type="button" variant="secondary" onClick={onRemove}>
          删除效果
        </InkButton>
      </div>
    </div>
  );
}

function RewardCatalogEditorCard({
  item,
  onChange,
  onRemove,
}: {
  item: RewardCatalogDraftItem;
  onChange: (nextItem: RewardCatalogDraftItem) => void;
  onRemove: () => void;
}) {
  const setCommonField = (key: 'id' | 'name' | 'description', value: string) => {
    onChange({
      ...item,
      [key]: value,
    });
  };

  const pillSpec =
    item.type === 'consumable' && item.spec.kind === 'pill' ? item.spec : null;
  const talismanSpec =
    item.type === 'consumable' && item.spec.kind === 'talisman'
      ? item.spec
      : null;

  const updatePillSpec = (
    updater: (spec: ConsumablePillDraft) => ConsumablePillDraft,
  ) => {
    if (item.type !== 'consumable' || !pillSpec) return;
    onChange({
      ...item,
      spec: updater(pillSpec),
    });
  };

  const updateTalismanSpec = (
    updater: (spec: ConsumableTalismanDraft) => ConsumableTalismanDraft,
  ) => {
    if (item.type !== 'consumable' || !talismanSpec) return;
    onChange({
      ...item,
      spec: updater(talismanSpec),
    });
  };

  return (
    <article className="border-ink/15 bg-paper/85 space-y-5 border border-dashed p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.18em]">
            {getTypeLabel(item.type)}
          </p>
          <h3 className="text-ink mt-2 text-xl font-semibold">
            {item.name.trim() || '未命名目录项'}
          </h3>
          <p className="text-ink-secondary mt-2 text-sm">
            {item.id.trim() || '未填写 ID'} · {getDraftMeta(item)}
          </p>
        </div>
        <div className="flex gap-2">
          <InkSelect
            label="类型"
            value={item.type}
            onChange={(value) => {
              const nextItem = createEmptyDraftItem(
                value as RewardCatalogDraftItem['type'],
              );
              onChange({
                ...nextItem,
                id: item.id,
                name: item.name,
                description: item.description,
              });
            }}
          >
            <option value="material">材料</option>
            <option value="consumable">消耗品</option>
            <option value="artifact">法宝</option>
          </InkSelect>
          <div className="pt-7">
            <InkButton type="button" variant="secondary" onClick={onRemove}>
              删除目录项
            </InkButton>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InkInput
          label="目录项 ID"
          value={item.id}
          onChange={(value) => setCommonField('id', value)}
          placeholder="例如：refined_iron"
          hint="仅支持字母、数字、_ 和 -。"
        />
        <InkInput
          label="名称"
          value={item.name}
          onChange={(value) => setCommonField('name', value)}
          placeholder="例如：精炼玄铁"
        />
        <InkInput
          label="描述（可选）"
          value={item.description}
          onChange={(value) => setCommonField('description', value)}
          placeholder="例如：常用于锻造法宝。"
        />
      </div>

      {item.type === 'material' ? (
        <div className="grid gap-3 md:grid-cols-3">
          <InkSelect
            label="材料类型"
            value={item.materialType}
            onChange={(value) =>
              onChange({
                ...item,
                materialType: value as (typeof MATERIAL_TYPE_VALUES)[number],
              })
            }
          >
            {MATERIAL_TYPE_VALUES.map((materialType) => (
              <option key={materialType} value={materialType}>
                {getMaterialTypeAlias(materialType)}
              </option>
            ))}
          </InkSelect>
          <InkSelect
            label="品质"
            value={item.rank}
            onChange={(value) =>
              onChange({
                ...item,
                rank: value as (typeof QUALITY_VALUES)[number],
              })
            }
          >
            {QUALITY_VALUES.map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </InkSelect>
          <InkSelect
            label="元素（可选）"
            value={item.element}
            onChange={(value) =>
              onChange({
                ...item,
                element: value as '' | (typeof ELEMENT_VALUES)[number],
              })
            }
          >
            <option value="">无</option>
            {ELEMENT_VALUES.map((element) => (
              <option key={element} value={element}>
                {element}
              </option>
            ))}
          </InkSelect>
        </div>
      ) : null}

      {item.type === 'artifact' ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <InkSelect
              label="装备槽位"
              value={item.slot}
              onChange={(value) =>
                onChange({
                  ...item,
                  slot: value as (typeof EQUIPMENT_SLOT_VALUES)[number],
                })
              }
            >
              {EQUIPMENT_SLOT_VALUES.map((slot) => (
                <option key={slot} value={slot}>
                  {getEquipmentSlotAlias(slot)}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="元素"
              value={item.element}
              onChange={(value) =>
                onChange({
                  ...item,
                  element: value as (typeof ELEMENT_VALUES)[number],
                })
              }
            >
              {ELEMENT_VALUES.map((element) => (
                <option key={element} value={element}>
                  {element}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="品质（可选）"
              value={item.quality}
              onChange={(value) =>
                onChange({
                  ...item,
                  quality: value as '' | (typeof QUALITY_VALUES)[number],
                })
              }
            >
              <option value="">未设置</option>
              {QUALITY_VALUES.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </InkSelect>
          </div>
          <InkInput
            label="效果列表（高级 JSON，可选）"
            value={item.effectsText}
            onChange={(value) =>
              onChange({
                ...item,
                effectsText: value,
              })
            }
            placeholder="[]"
            hint="法宝效果目前仍使用 JSON 数组，留空或 [] 表示无效果。"
            multiline
            rows={5}
          />
        </div>
      ) : null}

      {item.type === 'consumable' ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InkSelect
              label="消耗品类型"
              value={item.consumableType}
              onChange={(value) =>
                onChange({
                  ...item,
                  consumableType: value as (typeof CONSUMABLE_TYPE_VALUES)[number],
                })
              }
            >
              {CONSUMABLE_TYPE_VALUES.map((consumableType) => (
                <option key={consumableType} value={consumableType}>
                  {consumableType}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="品质（可选）"
              value={item.quality}
              onChange={(value) =>
                onChange({
                  ...item,
                  quality: value as '' | (typeof QUALITY_VALUES)[number],
                })
              }
            >
              <option value="">未设置</option>
              {QUALITY_VALUES.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </InkSelect>
            <InkInput
              label="提示词（可选）"
              value={item.prompt}
              onChange={(value) =>
                onChange({
                  ...item,
                  prompt: value,
                })
              }
              placeholder="例如：炼丹灵感描述"
            />
            <InkInput
              label="评分（可选）"
              value={item.score}
              onChange={(value) =>
                onChange({
                  ...item,
                  score: value,
                })
              }
              placeholder="例如：88"
            />
          </div>

          <div className="border-ink/12 bg-bgpaper/55 space-y-4 border border-dashed p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-ink-secondary text-xs tracking-[0.18em]">
                  规格
                </p>
                <h4 className="text-ink mt-1 text-lg font-semibold">
                  消耗品规格
                </h4>
              </div>
              <InkSelect
                label="规格类型"
                value={item.spec.kind}
                hint="丹药一般对应“丹药”，固定玩法符箓一般对应“符箓”。"
                onChange={(value) =>
                  onChange({
                    ...item,
                    spec:
                      value === 'pill'
                        ? createDefaultPillDraft()
                        : createDefaultTalismanDraft(),
                  })
                }
              >
                <option value="pill">{getSpecKindLabel('pill')}</option>
                <option value="talisman">{getSpecKindLabel('talisman')}</option>
              </InkSelect>
            </div>

            {item.consumableType === '符箓' ? (
              <div className="border-ink/12 bg-paper/70 space-y-3 border border-dashed p-4">
                <div>
                  <p className="text-ink-secondary text-xs tracking-[0.16em]">
                    快捷模板
                  </p>
                  <p className="text-ink mt-1 font-semibold">固定符箓快捷模板</p>
                  <p className="text-ink-secondary mt-1 text-sm leading-6">
                    这些符箓是系统固定玩法道具。点击后会自动填入名称、说明、玩法标识、
                    消耗时机与建议目录项 ID，你仍可以继续微调。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TALISMAN_QUICK_PRESETS.map((preset) => (
                    <InkButton
                      key={preset.id}
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        onChange(applyTalismanQuickPreset(item, preset.id))
                      }
                    >
                      {preset.name}
                    </InkButton>
                  ))}
                </div>
              </div>
            ) : null}

            {pillSpec ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InkSelect
                    label="丹药家族"
                    value={pillSpec.family}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        family: value as (typeof PILL_FAMILY_VALUES)[number],
                      }))
                    }
                  >
                    {PILL_FAMILY_VALUES.map((family) => (
                      <option key={family} value={family}>
                        {getPillFamilyAlias(family)}
                      </option>
                    ))}
                  </InkSelect>
                  <InkSelect
                    label="限额分类"
                    value={pillSpec.quotaCategory}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        quotaCategory:
                          value as (typeof PILL_QUOTA_CATEGORY_VALUES)[number],
                      }))
                    }
                  >
                    {PILL_QUOTA_CATEGORY_VALUES.map((quotaCategory) => (
                      <option key={quotaCategory} value={quotaCategory}>
                        {getPillQuotaCategoryAlias(quotaCategory)}
                      </option>
                    ))}
                  </InkSelect>
                  <InkSelect
                    label="炼制来源"
                    value={pillSpec.alchemySource}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        alchemySource: value as 'improvised' | 'formula',
                      }))
                    }
                  >
                    <option value="improvised">
                      {getAlchemySourceAlias('improvised')}
                    </option>
                    <option value="formula">
                      {getAlchemySourceAlias('formula')}
                    </option>
                  </InkSelect>
                  <InkSelect
                    label="主导元素（可选）"
                    value={pillSpec.dominantElement}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        dominantElement:
                          value as '' | (typeof ELEMENT_VALUES)[number],
                      }))
                    }
                  >
                    <option value="">无</option>
                    {ELEMENT_VALUES.map((element) => (
                      <option key={element} value={element}>
                        {element}
                      </option>
                    ))}
                  </InkSelect>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {pillSpec.alchemySource === 'formula' ? (
                    <InkInput
                      label="丹方 ID（可选）"
                      value={pillSpec.formulaId}
                      onChange={(value) =>
                        updatePillSpec((spec) => ({
                          ...spec,
                          formulaId: value,
                        }))
                      }
                      placeholder="例如：breakthrough-pill-v2"
                    />
                  ) : null}
                  <InkInput
                    label="稳定度"
                    value={pillSpec.stability}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        stability: value,
                      }))
                    }
                    placeholder="例如：80"
                  />
                  <InkInput
                    label="毒性评级"
                    value={pillSpec.toxicityRating}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        toxicityRating: value,
                      }))
                    }
                    placeholder="例如：12"
                  />
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <InkInput
                    label="来源材料（每行一项）"
                    value={pillSpec.sourceMaterialsText}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        sourceMaterialsText: value,
                      }))
                    }
                    placeholder={`例如：\n寒髓草\n玄铁砂`}
                    multiline
                    rows={4}
                  />
                  <InkInput
                    label="标签（每行一项）"
                    value={pillSpec.tagsText}
                    onChange={(value) =>
                      updatePillSpec((spec) => ({
                        ...spec,
                        tagsText: value,
                      }))
                    }
                    placeholder={`例如：\n疗伤\n筑基`}
                    multiline
                    rows={4}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-ink-secondary text-xs tracking-[0.16em]">
                        效果
                      </p>
                      <p className="text-ink mt-1 font-semibold">
                        服用效果
                      </p>
                      <p className="text-ink-secondary mt-1 text-sm">
                        下拉框均已切换为中文说明，仍会按原始内部值落库。
                      </p>
                    </div>
                    <InkButton
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        updatePillSpec((spec) => ({
                          ...spec,
                          operations: [
                            ...spec.operations,
                            createEmptyOperationDraft(),
                          ],
                        }))
                      }
                    >
                      添加效果
                    </InkButton>
                  </div>

                  {pillSpec.operations.map((operation, index) => (
                    <OperationEditor
                      key={`${operation.type}-${index}`}
                      operation={operation}
                      onChange={(nextOperation) =>
                        updatePillSpec((spec) => ({
                          ...spec,
                          operations: spec.operations.map(
                            (currentOperation, currentIndex) =>
                              currentIndex === index
                                ? nextOperation
                                : currentOperation,
                          ),
                        }))
                      }
                      onRemove={() =>
                        updatePillSpec((spec) => ({
                          ...spec,
                          operations: spec.operations.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ) : talismanSpec ? (
              <div className="space-y-4">
                <InkNotice className="mt-0 text-left not-italic" tone="info">
                  当前玩法：{talismanSpec.scenario
                    ? getTalismanScenarioAlias(talismanSpec.scenario)
                    : '未设置'}
                  。固定玩法符箓建议优先使用上方快捷模板。
                </InkNotice>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <InkInput
                  label="玩法标识"
                  value={talismanSpec.scenario}
                  onChange={(value) =>
                    updateTalismanSpec((spec) => ({
                      ...spec,
                      scenario: value,
                    }))
                  }
                  placeholder="例如：fate_reshape"
                  hint={
                    talismanSpec.scenario
                      ? `当前识别为：${getTalismanScenarioAlias(talismanSpec.scenario)}`
                      : '固定玩法可通过快捷模板自动填入，自定义玩法也可手填。'
                  }
                />
                <InkSelect
                  label="消耗时机"
                  value={talismanSpec.sessionMode}
                  onChange={(value) =>
                    updateTalismanSpec((spec) => ({
                      ...spec,
                      sessionMode:
                        value as (typeof TALISMAN_SESSION_MODE_VALUES)[number],
                    }))
                  }
                >
                  {TALISMAN_SESSION_MODE_VALUES.map((sessionMode) => (
                    <option key={sessionMode} value={sessionMode}>
                      {getTalismanSessionModeAlias(sessionMode)}
                    </option>
                  ))}
                </InkSelect>
                <InkInput
                  label="使用说明（可选）"
                  value={talismanSpec.notes}
                  onChange={(value) =>
                    updateTalismanSpec((spec) => ({
                      ...spec,
                      notes: value,
                    }))
                  }
                  placeholder="例如：前往玩法页后点击使用"
                />
              </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function RewardCatalogAdminPage() {
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<RewardCatalogDraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyCatalog = (catalog: RewardCatalogItem[]) => {
    setItems(catalog.map((item) => rewardCatalogItemToDraft(item)));
  };

  const loadCatalog = async () => {
    const response = await fetch('/api/admin/reward-catalog');
    const data = (await response.json()) as RewardCatalogResponse;
    if (!response.ok) {
      throw new Error(data.error ?? '加载奖励目录失败');
    }

    applyCatalog(data.catalog ?? []);
  };

  const reloadCatalog = async () => {
    setLoading(true);
    try {
      await loadCatalog();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '加载奖励目录失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/reward-catalog');
        const data = (await response.json()) as RewardCatalogResponse;
        if (!response.ok) {
          throw new Error(data.error ?? '加载奖励目录失败');
        }

        if (!cancelled) {
          applyCatalog(data.catalog ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '加载奖励目录失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  const submit = async () => {
    let catalog: RewardCatalogItem[];
    try {
      catalog = items.map((item) => rewardCatalogDraftToItem(item));
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '目录项配置错误',
        tone: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/reward-catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog }),
      });
      const data = (await response.json()) as RewardCatalogResponse;
      if (!response.ok) {
        throw new Error(data.error ?? '保存奖励目录失败');
      }

      applyCatalog(data.catalog ?? []);
      pushToast({ message: '奖励目录已保存并生效', tone: 'success' });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存奖励目录失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          REWARD CATALOG
        </p>
        <h2 className="font-heading text-ink mt-2 text-3xl">奖励目录</h2>
        <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
          在这里可视化维护兑换码和游戏内邮件补偿可用的道具目录。目录项保存道具快照，
          实际发放数量仍在兑换码或补偿邮件里单独填写。
        </p>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-5 border border-dashed p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <InkButton
              type="button"
              variant="primary"
              disabled={loading || saving}
              onClick={() => void submit()}
            >
              {saving ? '保存中...' : '保存目录'}
            </InkButton>
            <InkButton
              type="button"
              variant="secondary"
              disabled={loading || saving}
              onClick={() => void reloadCatalog()}
            >
              重新加载
            </InkButton>
          </div>

          <div className="flex flex-wrap gap-2">
            <InkButton
              type="button"
              variant="secondary"
              disabled={loading || saving}
              onClick={() =>
                setItems((current) => [...current, createEmptyDraftItem('material')])
              }
            >
              添加材料
            </InkButton>
            <InkButton
              type="button"
              variant="secondary"
              disabled={loading || saving}
              onClick={() =>
                setItems((current) => [
                  ...current,
                  createEmptyDraftItem('consumable'),
                ])
              }
            >
              添加消耗品
            </InkButton>
            <InkButton
              type="button"
              variant="secondary"
              disabled={loading || saving}
              onClick={() =>
                setItems((current) => [...current, createEmptyDraftItem('artifact')])
              }
            >
              添加法宝
            </InkButton>
          </div>
        </div>

        <InkNotice tone="info">
          目录只维护材料、消耗品、法宝；灵石在发奖时直接填写数量。当前已改为可视化编辑，
          只有完全开放结构的字段仍保留为高级文本输入。
        </InkNotice>

        <div className="border-ink/15 bg-paper/70 flex flex-wrap items-center gap-4 border border-dashed px-4 py-3 text-sm">
          <span className="text-ink font-semibold">当前目录项：{items.length}</span>
          <span className="text-ink-secondary">
            材料 {items.filter((item) => item.type === 'material').length} 项
          </span>
          <span className="text-ink-secondary">
            消耗品 {items.filter((item) => item.type === 'consumable').length} 项
          </span>
          <span className="text-ink-secondary">
            法宝 {items.filter((item) => item.type === 'artifact').length} 项
          </span>
        </div>

        {items.length === 0 ? (
          <InkNotice tone="warning">
            当前还没有目录项。可先添加材料、消耗品或法宝，再保存生效。
          </InkNotice>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <RewardCatalogEditorCard
                key={`${item.type}-${item.id || 'new'}-${index}`}
                item={item}
                onChange={(nextItem) =>
                  setItems((current) =>
                    current.map((currentItem, currentIndex) =>
                      currentIndex === index ? nextItem : currentItem,
                    ),
                  )
                }
                onRemove={() =>
                  setItems((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index),
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

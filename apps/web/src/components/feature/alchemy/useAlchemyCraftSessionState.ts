import {
  getQiErrorMessage,
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { apiFetch } from '@app/lib/api/fetch';
import { pendingCommandRequest } from '@app/lib/pendingCommandRequest';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCurrency,
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import type { PlayerResourceMutationMeta } from '@daoyou/contracts/player';
import {
  ALCHEMY_INPUT_CONSTRAINTS,
  ALCHEMY_MAX_DOSE,
} from '@daoyou/game-content/alchemy';
import type { Material } from '@daoyou/game-domain/character';
import type {
  AlchemyFormula,
  AlchemyMode,
} from '@daoyou/game-domain/consumables';
import {
  createElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AddMaterialResult,
  AlchemyResultState,
  AlchemySectContext,
  AlchemyWorkspacePhase,
  FormulaAnalysisState,
  MaterialDraft,
  ReadinessState,
} from './alchemyTypes';

export const ALCHEMY_MIN_DOSE =
  ALCHEMY_INPUT_CONSTRAINTS.minQuantityPerMaterial;
export const ALCHEMY_MAX_MATERIALS = ALCHEMY_INPUT_CONSTRAINTS.maxMaterialKinds;
export { ALCHEMY_MAX_DOSE };

const EMPTY_MATERIALS: MaterialDraft = { ids: [], map: {}, doses: {} };
const EMPTY_READINESS: ReadinessState = {
  key: null,
  estimatedSpiritStones: null,
  estimatedQi: null,
  validation: null,
  canAfford: true,
  error: null,
  loading: false,
};
const EMPTY_RESULT: AlchemyResultState = {
  consumable: null,
  consumables: [],
  craftedConsumables: [],
  yieldProfile: null,
  formulaDiscovery: null,
  formulaProgress: null,
};
const EMPTY_ANALYSIS: FormulaAnalysisState = {
  value: null,
  loading: false,
  error: null,
  cooldownRemaining: 0,
};

type ReadinessResponse = {
  success: boolean;
  data?: {
    cost: { spiritStones: number; qi: number };
    canAfford: boolean;
    validation: ReadinessState['validation'];
  };
  error?: string;
};
type AnalyzeResponse = {
  success: boolean;
  data?: FormulaAnalysisState['value'];
  error?: string;
  message?: string;
  remainingSeconds?: number;
  state?: PlayerResourceMutationMeta;
  analysisFinal?: boolean;
};
type DiscoveryResponse = {
  success: boolean;
  data?: { saved: boolean; formula?: AlchemyFormula };
  error?: string;
};
type CraftResult = Omit<
  AlchemyResultState,
  'formulaDiscovery' | 'formulaProgress'
> & {
  formulaDiscovery?: AlchemyResultState['formulaDiscovery'];
  formulaProgress?: AlchemyResultState['formulaProgress'];
};

function buildCraftConfirmationDetails(items: Array<[string, ReactNode]>) {
  return createElement(
    'dl',
    { className: 'space-y-2' },
    ...items.map(([label, value]) =>
      createElement(
        'div',
        {
          key: label,
          className: 'grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)]',
        },
        createElement('dt', { className: 'text-ink-secondary' }, label),
        createElement('dd', null, value),
      ),
    ),
  );
}

export function useAlchemyCraftSessionState(sectContext?: AlchemySectContext) {
  const profile = useCultivatorIdentity();
  const currency = useCultivatorCurrency();
  const playerSession = usePlayerSession();
  const identity = profile.data?.cultivator;
  const cultivator = useMemo(
    () =>
      identity?.id && currency.data
        ? {
            id: identity.id,
            realm: identity.realm,
            spiritStones: currency.data.spiritStones,
          }
        : null,
    [currency.data, identity?.id, identity?.realm],
  );
  const { mutate, consumeChanges } = useResourceMutation();
  const { pushToast } = useInkUI();
  const { openQiActionConfirm } = useQiActionConfirm();
  const [phase, setPhase] = useState<AlchemyWorkspacePhase>('preparing');
  const [mode, setModeState] = useState<AlchemyMode>('improvised');
  const [intent, setIntentState] = useState('');
  const [formula, setFormula] = useState<AlchemyFormula | null>(null);
  const [materials, setMaterials] = useState<MaterialDraft>(EMPTY_MATERIALS);
  const [readiness, setReadiness] = useState<ReadinessState>(EMPTY_READINESS);
  const [analysis, setAnalysis] =
    useState<FormulaAnalysisState>(EMPTY_ANALYSIS);
  const [result, setResult] = useState<AlchemyResultState>(EMPTY_RESULT);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const analysisKeyRef = useRef<string | null>(null);
  const analysisExpiryTimerRef = useRef<number | null>(null);
  const analysisExpiresAtRef = useRef(0);
  const analysisRequestRef = useRef<AbortController | null>(null);

  const materialQuantities = useMemo(
    () =>
      Object.fromEntries(
        materials.ids.map((id) => [
          id,
          materials.doses[id] ?? ALCHEMY_MIN_DOSE,
        ]),
      ),
    [materials.doses, materials.ids],
  );
  const materialVersions = useMemo(
    () =>
      Object.fromEntries(
        materials.ids.map((id) => [
          id,
          JSON.stringify(
            (materials.map[id] as Material & { members?: unknown }).members ??
              [],
          ),
        ]),
      ),
    [materials.ids, materials.map],
  );
  const selectionKey = useMemo(
    () =>
      JSON.stringify({
        owner: cultivator?.id ?? null,
        mode,
        formula,
        ids: materials.ids,
        materialQuantities,
        materialVersions,
      }),
    [
      cultivator?.id,
      formula,
      materialQuantities,
      materialVersions,
      materials.ids,
      mode,
    ],
  );
  const selectionKeyRef = useRef(selectionKey);
  useLayoutEffect(() => {
    selectionKeyRef.current = selectionKey;
  }, [selectionKey]);
  const qiCost = readiness.estimatedQi ?? 1;
  const formulaQiCostPaid =
    typeof analysis.value?.qiCostPaid === 'number'
      ? analysis.value.qiCostPaid
      : null;
  const canReuseFormulaAnalysis = Boolean(
    mode === 'formula' &&
    analysis.value?.valid &&
    analysis.value.analysisId &&
    analysisKeyRef.current === selectionKey &&
    analysisExpiresAtRef.current > 0,
  );
  const readyForReadinessCheck =
    materials.ids.length > 0 && (mode === 'improvised' || Boolean(formula));
  const readinessIsFresh =
    readiness.key === selectionKey &&
    readiness.estimatedSpiritStones !== null &&
    !readiness.loading;
  const readyForCostConfirmation = Boolean(
    readyForReadinessCheck &&
    readinessIsFresh &&
    readiness.validation?.valid !== false &&
    readiness.canAfford &&
    !readiness.error,
  );
  const readyForFormulaAnalysis =
    mode === 'formula' && Boolean(formula) && readyForCostConfirmation;
  const readyForImprovisedFire = Boolean(
    mode === 'improvised' &&
    phase === 'preparing' &&
    readyForCostConfirmation &&
    intent.trim(),
  );
  const readyForFormulaFire = Boolean(
    mode === 'formula' &&
    phase === 'observing' &&
    readyForCostConfirmation &&
    canReuseFormulaAnalysis,
  );

  const clearAnalysis = useCallback(() => {
    if (analysisExpiryTimerRef.current !== null) {
      window.clearTimeout(analysisExpiryTimerRef.current);
      analysisExpiryTimerRef.current = null;
    }
    analysisKeyRef.current = null;
    analysisExpiresAtRef.current = 0;
    setAnalysis((current) => ({
      ...EMPTY_ANALYSIS,
      loading: Boolean(analysisRequestRef.current),
      cooldownRemaining: current.cooldownRemaining,
    }));
  }, []);

  useEffect(() => {
    if (analysisKeyRef.current && analysisKeyRef.current !== selectionKey) {
      clearAnalysis();
      setPhase((current) => (current === 'observing' ? 'preparing' : current));
    }
  }, [clearAnalysis, selectionKey]);

  const invalidateObservation = useCallback(() => {
    setPhase('preparing');
    setReadiness(EMPTY_READINESS);
    setResult(EMPTY_RESULT);
    setStatus('');
    clearAnalysis();
  }, [clearAnalysis]);

  const setMode = useCallback(
    (nextMode: AlchemyMode) => {
      if (nextMode === mode) return;
      setModeState(nextMode);
      invalidateObservation();
    },
    [invalidateObservation, mode],
  );

  const setIntent = useCallback(
    (nextIntent: string) => {
      setIntentState(nextIntent);
      if (phase !== 'preparing') setPhase('preparing');
      setResult(EMPTY_RESULT);
      setStatus('');
      clearAnalysis();
    },
    [clearAnalysis, phase],
  );

  const selectFormula = useCallback(
    (nextFormula: AlchemyFormula) => {
      if (
        phase !== 'result' &&
        mode === 'formula' &&
        JSON.stringify(nextFormula) === JSON.stringify(formula)
      )
        return;
      if (phase === 'result') {
        setMaterials(EMPTY_MATERIALS);
        setIntentState('');
      }
      setFormula(nextFormula);
      setModeState('formula');
      invalidateObservation();
    },
    [formula, invalidateObservation, mode, phase],
  );

  const addMaterialToFurnace = useCallback(
    (
      material: Material,
      dose: number = ALCHEMY_MIN_DOSE,
    ): AddMaterialResult => {
      if (!material.id) return 'limit-reached';
      const amount = Math.max(
        ALCHEMY_MIN_DOSE,
        Math.min(
          ALCHEMY_MAX_DOSE,
          material.quantity ?? 1,
          Math.floor(dose) || 1,
        ),
      );
      if (materials.ids.includes(material.id)) {
        if (
          materials.doses[material.id] === amount &&
          JSON.stringify(materials.map[material.id]) ===
            JSON.stringify(material)
        )
          return 'already-added';
        setMaterials((current) => ({
          ...current,
          map: { ...current.map, [material.id!]: material },
          doses: { ...current.doses, [material.id!]: amount },
        }));
        invalidateObservation();
        return 'already-added';
      }
      if (phase !== 'result' && materials.ids.length >= ALCHEMY_MAX_MATERIALS)
        return 'limit-reached';
      if (phase === 'result') {
        setMaterials({
          ids: [material.id],
          map: { [material.id]: material },
          doses: { [material.id]: amount },
        });
      } else {
        setMaterials((current) => ({
          ids: [...current.ids, material.id!],
          map: { ...current.map, [material.id!]: material },
          doses: { ...current.doses, [material.id!]: amount },
        }));
      }
      invalidateObservation();
      return 'added';
    },
    [
      invalidateObservation,
      materials.doses,
      materials.ids,
      materials.map,
      phase,
    ],
  );

  const removeMaterial = useCallback(
    (id: string) => {
      setMaterials((current) => {
        const map = { ...current.map };
        const doses = { ...current.doses };
        delete map[id];
        delete doses[id];
        return {
          ids: current.ids.filter((item) => item !== id),
          map,
          doses,
        };
      });
      invalidateObservation();
    },
    [invalidateObservation],
  );

  const toggleMaterial = useCallback(
    (id: string, material?: Material) => {
      if (materials.ids.includes(id)) {
        removeMaterial(id);
        return;
      }
      if (!material) return;
      const outcome = addMaterialToFurnace(material);
      if (outcome === 'limit-reached')
        pushToast({
          message: `一炉最多投入 ${ALCHEMY_MAX_MATERIALS} 种灵材。`,
          tone: 'warning',
        });
    },
    [addMaterialToFurnace, materials.ids, pushToast, removeMaterial],
  );

  const setMaterialDose = useCallback(
    (id: string, dose: number) => {
      const material = materials.map[id];
      const available = Math.max(
        ALCHEMY_MIN_DOSE,
        material?.quantity ?? ALCHEMY_MAX_DOSE,
      );
      const next = Math.max(
        ALCHEMY_MIN_DOSE,
        Math.min(ALCHEMY_MAX_DOSE, available, Math.floor(dose)),
      );
      if (next === (materials.doses[id] ?? ALCHEMY_MIN_DOSE)) return;
      setMaterials((current) => ({
        ...current,
        doses: { ...current.doses, [id]: next },
      }));
      invalidateObservation();
    },
    [invalidateObservation, materials.doses, materials.map],
  );

  useEffect(() => {
    if (!readyForReadinessCheck) {
      setReadiness(EMPTY_READINESS);
      return;
    }
    const params = new URLSearchParams({
      craftType: 'alchemy',
      alchemyMode: mode,
      materialIds: materials.ids.join(','),
      materialQuantities: JSON.stringify(materialQuantities),
      materialVersions: JSON.stringify(materialVersions),
    });
    if (mode === 'formula' && formula?.id) params.set('formulaId', formula.id);
    const controller = new AbortController();
    setReadiness((current) => ({
      ...current,
      key: selectionKey,
      loading: true,
      error: null,
    }));
    void apiFetch(`/api/craft?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => ({
        response,
        body: (await response.json()) as ReadinessResponse,
      }))
      .then(({ response, body }) => {
        if (controller.signal.aborted) return;
        if (!response.ok || !body.success || !body.data)
          throw new Error(body.error || '材料检查失败');
        setReadiness({
          key: selectionKey,
          estimatedSpiritStones: body.data.cost.spiritStones,
          estimatedQi: body.data.cost.qi,
          validation: body.data.validation,
          canAfford: body.data.canAfford,
          error: null,
          loading: false,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setReadiness({
          ...EMPTY_READINESS,
          key: selectionKey,
          error: error instanceof Error ? error.message : '材料检查失败',
        });
      });
    return () => controller.abort();
  }, [
    formula?.id,
    materialQuantities,
    materialVersions,
    materials.ids,
    mode,
    readyForReadinessCheck,
    selectionKey,
  ]);

  useEffect(() => {
    if (analysis.cooldownRemaining <= 0) return;
    const timer = window.setInterval(
      () =>
        setAnalysis((current) => ({
          ...current,
          cooldownRemaining: Math.max(0, current.cooldownRemaining - 1),
        })),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [analysis.cooldownRemaining]);

  useEffect(
    () => () => {
      analysisRequestRef.current?.abort();
      if (analysisExpiryTimerRef.current !== null)
        window.clearTimeout(analysisExpiryTimerRef.current);
    },
    [],
  );

  const analyzeFormula = useCallback(async (): Promise<boolean> => {
    if (
      !formula?.id ||
      !cultivator ||
      !readyForFormulaAnalysis ||
      analysis.cooldownRemaining > 0 ||
      analysisRequestRef.current ||
      selectionKeyRef.current !== selectionKey
    )
      return false;
    clearAnalysis();
    setAnalysis((current) => ({ ...current, loading: true, error: null }));
    const controller = new AbortController();
    analysisRequestRef.current = controller;
    try {
      const payload = {
        materialIds: materials.ids,
        materialQuantities,
        materialVersions,
      };
      const pending = pendingCommandRequest(
        cultivator.id,
        'alchemy-formula-analysis',
        { formulaId: formula.id, ...payload },
      );
      const response = await apiFetch(
        `/api/alchemy/formulas/${formula.id}/analyze`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, requestId: pending.requestId }),
        },
      );
      const body = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !body.success || !body.data) {
        if (body.state) {
          consumeChanges(body.state);
          currency.invalidate();
        }
        if (body.analysisFinal === true) pending.complete();
        if (
          selectionKeyRef.current === selectionKey &&
          typeof body.remainingSeconds === 'number'
        )
          setAnalysis((current) => ({
            ...current,
            cooldownRemaining: body.remainingSeconds!,
          }));
        throw new Error(getQiErrorMessage(body, '丹方分析失败'));
      }
      const data = body.state
        ? await mutate(
            Promise.resolve({
              success: true as const,
              data: body.data,
              state: body.state,
            }),
          )
        : body.data;
      pending.complete();
      if (body.state?.replayed) currency.invalidate();
      if (controller.signal.aborted || selectionKeyRef.current !== selectionKey)
        return false;
      analysisKeyRef.current = selectionKey;
      analysisExpiresAtRef.current = Date.now() + data.expiresInSeconds * 1000;
      if (analysisExpiryTimerRef.current !== null)
        window.clearTimeout(analysisExpiryTimerRef.current);
      analysisExpiryTimerRef.current = window.setTimeout(() => {
        analysisKeyRef.current = null;
        analysisExpiresAtRef.current = 0;
        analysisExpiryTimerRef.current = null;
        setAnalysis((current) => ({
          ...EMPTY_ANALYSIS,
          cooldownRemaining: current.cooldownRemaining,
          error: '本次丹方分析已过期，请重新查看炼制预览。',
        }));
        setPhase('preparing');
      }, data.expiresInSeconds * 1000);
      setAnalysis({
        value: data,
        loading: false,
        error: null,
        cooldownRemaining: data.cooldownRemainingSeconds,
      });
      return true;
    } catch (error) {
      if (controller.signal.aborted || selectionKeyRef.current !== selectionKey)
        return false;
      setAnalysis((current) => ({
        ...current,
        value: null,
        loading: false,
        error: error instanceof Error ? error.message : '丹方分析失败',
      }));
      return false;
    } finally {
      if (analysisRequestRef.current === controller) {
        analysisRequestRef.current = null;
        if (!controller.signal.aborted)
          setAnalysis((current) => ({ ...current, loading: false }));
      }
    }
  }, [
    analysis.cooldownRemaining,
    clearAnalysis,
    consumeChanges,
    cultivator,
    currency,
    formula?.id,
    materialQuantities,
    materialVersions,
    materials.ids,
    mutate,
    readyForFormulaAnalysis,
    selectionKey,
  ]);

  const analyzeCurrentFormula = useCallback(() => {
    if (analysisRequestRef.current) return;
    if (canReuseFormulaAnalysis && analysisExpiresAtRef.current > Date.now()) {
      setPhase('observing');
      return;
    }
    if (!readyForFormulaAnalysis || analysis.cooldownRemaining > 0) return;
    openQiActionConfirm({
      actionName: '推演药路',
      qiCost,
      confirmLabel: '确认推演',
      details: buildCraftConfirmationDetails([
        ['丹方', formula?.name ?? '未选择'],
        ['推演说明', '推演时消耗灵气，失败退还；开炉只扣灵石和材料。'],
      ]),
      onConfirm: async () => {
        if (await analyzeFormula()) setPhase('observing');
      },
    });
  }, [
    analysis.cooldownRemaining,
    analyzeFormula,
    canReuseFormulaAnalysis,
    formula?.name,
    openQiActionConfirm,
    qiCost,
    readyForFormulaAnalysis,
  ]);

  const returnToPreparation = useCallback(() => setPhase('preparing'), []);

  const submitPayload = useMemo(
    () => ({
      craftType: 'alchemy' as const,
      alchemyMode: mode,
      materialIds: materials.ids,
      materialQuantities,
      materialVersions,
      userPrompt: mode === 'improvised' ? intent.trim() : undefined,
      formulaId: mode === 'formula' ? formula?.id : undefined,
      analysisId: mode === 'formula' ? analysis.value?.analysisId : undefined,
    }),
    [
      analysis.value?.analysisId,
      formula?.id,
      intent,
      materialQuantities,
      materialVersions,
      materials.ids,
      mode,
    ],
  );

  const resolveDiscovery = useCallback(
    async (save: boolean) => {
      const discovery = result.formulaDiscovery;
      if (!discovery) return;
      try {
        const response = await apiFetch(
          '/api/alchemy/formulas/discovery/confirm',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: discovery.token, accept: save }),
          },
        );
        const body = (await response.json()) as DiscoveryResponse;
        if (!response.ok || !body.success)
          throw new Error(body.error || '丹方留存失败');
        setResult((current) => ({ ...current, formulaDiscovery: null }));
        if (save)
          pushToast({
            message: body.data?.formula
              ? `已将【${body.data.formula.name}】收入玉简。`
              : '新丹方已收入玉简。',
            tone: 'success',
          });
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '丹方留存失败',
          tone: 'danger',
        });
      }
    },
    [pushToast, result.formulaDiscovery],
  );

  const requestCraft = useCallback(
    (expectedMode: AlchemyMode) => {
      const ready =
        expectedMode === 'improvised'
          ? readyForImprovisedFire
          : readyForFormulaFire;
      if (!cultivator || mode !== expectedMode || !ready || submitting) return;
      const craftQiCost =
        expectedMode === 'formula' && formulaQiCostPaid !== null ? 0 : qiCost;
      const totalDose = materials.ids.reduce(
        (sum, id) => sum + (materials.doses[id] ?? ALCHEMY_MIN_DOSE),
        0,
      );
      const details = buildCraftConfirmationDetails([
        [
          expectedMode === 'improvised' ? '炼制目标' : '丹方',
          expectedMode === 'improvised'
            ? intent.trim()
            : (formula?.name ?? '未选择'),
        ],
        ['材料投入', `${materials.ids.length} 味 · 共 ${totalDose} 份`],
        [
          '灵石消耗',
          createElement(
            'span',
            null,
            createElement(SpiritStones, {
              amount: readiness.estimatedSpiritStones ?? 0,
            }),
            ' 枚',
          ),
        ],
        [
          '天地灵气',
          expectedMode === 'formula' && formulaQiCostPaid !== null
            ? `推演已消耗 ${formulaQiCostPaid} 点，开炉不再扣除。`
            : `${craftQiCost} 点`,
        ],
        ...(expectedMode === 'improvised'
          ? ([
              [
                '结果说明',
                '随心炼制无法预知丹药效果、品阶与数量，结果将在开鼎后揭晓。',
              ],
            ] as Array<[string, string]>)
          : []),
      ]);
      openQiActionConfirm({
        actionName: expectedMode === 'formula' ? '依方炼制' : '随心炼制',
        qiCost: craftQiCost,
        confirmLabel: expectedMode === 'improvised' ? '确认尝试' : '确认炼制',
        details,
        onConfirm: async () => {
          const fireStartedAt = performance.now();
          setPhase('firing');
          setSubmitting(true);
          setStatus(
            expectedMode === 'improvised'
              ? '炉门闭合，陌生药气正在火中交汇……'
              : '炉门闭合，地火正沿丹方阵纹攀升……',
          );
          setResult(EMPTY_RESULT);
          const firePulse = window.setTimeout(
            () =>
              setStatus(
                expectedMode === 'improvised'
                  ? '炉腹轰鸣，材料正在火中发生未知变化……'
                  : '炉腹轰鸣，杂气正按既定火路逐层煅去……',
              ),
            700,
          );
          const essencePulse = window.setTimeout(
            () =>
              setStatus(
                expectedMode === 'improvised'
                  ? '炉火渐稳，最终结果仍要等开鼎才能知晓……'
                  : '药蕴回旋，丹药正在不同火层中凝形……',
              ),
            1500,
          );
          try {
            const pending = pendingCommandRequest(
              cultivator.id,
              'alchemy',
              submitPayload,
            );
            const body = await mutate<CraftResult>(
              apiFetch('/api/craft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...submitPayload,
                  requestId: pending.requestId,
                }),
              }),
            );
            pending.complete();
            if (expectedMode === 'formula') clearAnalysis();
            if (!body.consumable) throw new Error('炉中未能凝丹');
            if (
              !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ) {
              const remaining = 1800 - (performance.now() - fireStartedAt);
              if (remaining > 0)
                await new Promise<void>((resolve) =>
                  window.setTimeout(resolve, remaining),
                );
            }
            setResult({
              consumable: body.consumable,
              consumables: body.consumables ?? [body.consumable],
              craftedConsumables: body.craftedConsumables ??
                body.consumables ?? [body.consumable],
              yieldProfile: body.yieldProfile ?? null,
              formulaDiscovery: body.formulaDiscovery ?? null,
              formulaProgress: body.formulaProgress ?? null,
            });
            setStatus('炉鸣三响，丹香已从炉隙逸出。');
            setPhase('result');
          } catch (error) {
            const message = error instanceof Error ? error.message : '炼丹失败';
            setStatus(message);
            const analysisInvalid =
              expectedMode === 'formula' &&
              (message.includes('请先推演药路') ||
                message.includes('材料已发生变化'));
            if (analysisInvalid) clearAnalysis();
            setPhase(
              expectedMode === 'improvised' || analysisInvalid
                ? 'preparing'
                : 'observing',
            );
            pushToast({ message, tone: 'danger' });
          } finally {
            window.clearTimeout(firePulse);
            window.clearTimeout(essencePulse);
            setSubmitting(false);
          }
        },
      });
    },
    [
      clearAnalysis,
      cultivator,
      formula?.name,
      formulaQiCostPaid,
      intent,
      materials.doses,
      materials.ids,
      mode,
      mutate,
      openQiActionConfirm,
      pushToast,
      qiCost,
      readiness.estimatedSpiritStones,
      readyForFormulaFire,
      readyForImprovisedFire,
      submitPayload,
      submitting,
    ],
  );

  const requestImprovisedFire = useCallback(
    () => requestCraft('improvised'),
    [requestCraft],
  );
  const requestFormulaFire = useCallback(
    () => requestCraft('formula'),
    [requestCraft],
  );

  const startNextBatch = useCallback(() => {
    setPhase('preparing');
    setIntentState('');
    setFormula(null);
    setMaterials(EMPTY_MATERIALS);
    setReadiness(EMPTY_READINESS);
    setResult(EMPTY_RESULT);
    setStatus('');
    clearAnalysis();
  }, [clearAnalysis]);

  const resetDraft = useCallback(() => {
    setModeState('improvised');
    startNextBatch();
  }, [startNextBatch]);

  return {
    cultivator,
    loading: profile.loading || currency.loading || playerSession.loading,
    note: playerSession.data?.note,
    sectContext,
    phase,
    mode,
    intent,
    formula,
    materials,
    readiness,
    analysis,
    result,
    submitting,
    status,
    qiCost,
    formulaQiCostPaid,
    canReuseFormulaAnalysis,
    totalDose: materials.ids.reduce(
      (sum, id) => sum + (materials.doses[id] ?? ALCHEMY_MIN_DOSE),
      0,
    ),
    readyForCostConfirmation,
    readyForFormulaAnalysis,
    readyForImprovisedFire,
    readyForFormulaFire,
    setMode,
    setIntent,
    selectFormula,
    addMaterialToFurnace,
    toggleMaterial,
    removeMaterial,
    setMaterialDose,
    analyzeFormula: analyzeCurrentFormula,
    returnToPreparation,
    requestImprovisedFire,
    requestFormulaFire,
    startNextBatch,
    resetDraft,
    resolveDiscovery,
  };
}

export type AlchemyCraftSession = ReturnType<
  typeof useAlchemyCraftSessionState
>;

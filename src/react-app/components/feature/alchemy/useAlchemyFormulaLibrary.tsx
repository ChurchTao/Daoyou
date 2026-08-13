import { useInkUI } from '@app/components/providers/InkUIProvider';
import type { AlchemyFormula, PillFamily } from '@shared/types/consumable';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormulaPagination } from './alchemyTypes';

const EMPTY_PAGINATION: FormulaPagination = {
  page: 1,
  pageSize: 6,
  total: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

type FormulaResponse = {
  success: boolean;
  data?: { formulas: AlchemyFormula[]; pagination: FormulaPagination };
  error?: string;
};
type DeleteFormulaResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

export function useAlchemyFormulaLibrary({
  enabled = true,
  pageSize = 5,
}: {
  enabled?: boolean;
  pageSize?: number;
} = {}) {
  const { pushToast, openDialog } = useInkUI();
  const [formulas, setFormulas] = useState<AlchemyFormula[]>([]);
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [family, setFamilyState] = useState<PillFamily | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] =
    useState<FormulaPagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const refreshTokenRef = useRef(0);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (family !== 'all') params.set('family', family);
    void Promise.resolve()
      .then(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(true);
        setError(null);
        return fetch(`/api/alchemy/formulas?${params.toString()}`, {
          signal: controller.signal,
        });
      })
      .then(async (response) => {
        if (!response) return undefined;
        return {
          response,
          body: (await response.json()) as FormulaResponse,
        };
      })
      .then((result) => {
        if (!result) return;
        const { response, body } = result;
        if (!response.ok || !body.success || !body.data)
          throw new Error(body.error || '丹方玉简读取失败');
        if (requestId !== requestIdRef.current) return;
        setFormulas(body.data.formulas);
        setPagination(body.data.pagination);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError')
          return;
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setError(reason instanceof Error ? reason.message : '丹方玉简读取失败');
      });
    return () => controller.abort();
  }, [debouncedSearch, enabled, family, page, pageSize, refreshToken]);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);
  const setFamily = useCallback((value: PillFamily | 'all') => {
    setFamilyState(value);
    setPage(1);
  }, []);
  const reload = useCallback(() => {
    refreshTokenRef.current += 1;
    setRefreshToken(refreshTokenRef.current);
  }, []);

  const deleteFormula = useCallback(
    (formula: AlchemyFormula) => {
      openDialog({
        title: '删除丹方',
        content: (
          <div className="space-y-2 py-2 text-center">
            <p>确定要删除丹方【{formula.name}】吗？</p>
            <p className="text-ink-secondary text-xs">
              此操作不会影响已经炼成的丹药。
            </p>
          </div>
        ),
        confirmLabel: '确认删除',
        cancelLabel: '保留',
        onConfirm: async () => {
          try {
            const response = await fetch(
              `/api/alchemy/formulas/${formula.id}`,
              { method: 'DELETE' },
            );
            const body = (await response.json()) as DeleteFormulaResponse;
            if (!response.ok || !body.success)
              throw new Error(body.error || '丹方删除失败');
            pushToast({
              message: body.message || `已删除丹方【${formula.name}】。`,
              tone: 'success',
            });
            if (formulas.length === 1 && page > 1) setPage(page - 1);
            else reload();
          } catch (reason) {
            pushToast({
              message:
                reason instanceof Error ? reason.message : '丹方删除失败',
              tone: 'danger',
            });
          }
        },
      });
    },
    [formulas.length, openDialog, page, pushToast, reload],
  );

  return {
    formulas,
    search,
    family,
    page,
    pagination,
    loading,
    error,
    setSearch,
    setFamily,
    setPage,
    reload,
    deleteFormula,
  };
}

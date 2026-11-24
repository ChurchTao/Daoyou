import { InkButton, InkNotice } from '@app/components/ui';
import { baixiaoPost, requestBaixiao } from '@app/lib/api/baixiao';
import type {
  BaixiaoAdminView,
  BaixiaoImportResult,
  BaixiaoQuestionStatus,
} from '@daoyou/contracts/baixiao/meet';
import type { BaixiaoQuestionData } from '@daoyou/game-domain/baixiao/question';
import { useEffect, useRef, useState } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';
import { BaixiaoBankList } from './BaixiaoBankList';
import { BaixiaoBankOverview, BaixiaoRoundStatus } from './BaixiaoBankOverview';
import { BaixiaoImportDialog } from './BaixiaoImportDialog';
import { BaixiaoPractice } from './BaixiaoPractice';
import { statusLabels } from './presentation';

const endpoint = '/api/admin/baixiao-meet';

export default function BaixiaoAdminRoute() {
  const [data, setData] = useState<BaixiaoAdminView | null>(null);
  const [dialog, setDialog] = useState<'import' | 'practice' | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const reading = useRef<AbortController>(null);

  useEffect(() => {
    const request = new AbortController();
    reading.current = request;
    void requestBaixiao<BaixiaoAdminView>(endpoint, { signal: request.signal })
      .then((result) => {
        if (!request.signal.aborted) setData(result);
      })
      .catch((cause: unknown) => {
        if (!request.signal.aborted)
          setError(cause instanceof Error ? cause.message : '题库读取失败。');
      });
    return () => {
      request.abort();
      if (reading.current === request) reading.current = null;
    };
  }, [revision]);

  function refresh() {
    setError('');
    setRevision((value) => value + 1);
  }

  async function importBank(body: { questions: BaixiaoQuestionData[] }) {
    const result = await requestBaixiao<BaixiaoImportResult>(
      `${endpoint}/import`,
      baixiaoPost(body),
    );
    setNotice('');
    refresh();
    return result;
  }

  async function changeStatus(ids: string[], status: BaixiaoQuestionStatus) {
    reading.current?.abort();
    setPending(true);
    setNotice('');
    setError('');
    try {
      setData(
        await requestBaixiao<BaixiaoAdminView>(
          `${endpoint}/status`,
          baixiaoPost({ ids, status }),
        ),
      );
      setNotice(`已${statusLabels[status]} ${ids.length} 题。`);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '题目状态更新失败。');
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="百晓盛会题库"
        actions={
          <>
            <InkButton
              variant="secondary"
              className="min-h-11"
              disabled={!data || pending}
              onClick={() => setDialog('practice')}
            >
              答题试玩
            </InkButton>
            <InkButton
              variant="primary"
              className="min-h-11"
              disabled={pending}
              onClick={() => setDialog('import')}
            >
              批量导入
            </InkButton>
          </>
        }
      />
      {error && (
        <div role="alert">
          <InkNotice tone="warning">
            {error} <InkButton onClick={refresh}>刷新题库</InkButton>
          </InkNotice>
        </div>
      )}
      {notice && (
        <p role="status" className="text-teal text-sm">
          {notice}
        </p>
      )}
      {data ? (
        <>
          <BaixiaoRoundStatus data={data} />
          <BaixiaoBankOverview data={data} />
          <BaixiaoBankList
            bank={data.bank}
            pending={pending}
            changeStatus={changeStatus}
          />
          <BaixiaoPractice
            open={dialog === 'practice'}
            onClose={() => setDialog(null)}
            bank={data.bank}
          />
        </>
      ) : (
        !error && (
          <p role="status" className="text-ink-secondary text-sm">
            正在读取题库…
          </p>
        )
      )}
      <BaixiaoImportDialog
        open={dialog === 'import'}
        onClose={() => setDialog(null)}
        onImport={importBank}
      />
    </div>
  );
}

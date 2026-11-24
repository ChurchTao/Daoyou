import { InkButton, InkInput } from '@app/components/ui';
import {
  BaixiaoImportSchema,
  type BaixiaoImportResult,
} from '@daoyou/contracts/baixiao/meet';
import type { BaixiaoQuestionData } from '@daoyou/game-domain/baixiao/question';
import { useState } from 'react';
import { AdminDialog } from '../_components/AdminDialog';

const example = JSON.stringify(
  {
    questions: [
      {
        knowledgeKey: 'example-unique-key',
        category: 'literature',
        difficulty: 'medium',
        kind: 'choice',
        prompt: '题干',
        options: ['正确选项', '干扰项甲', '干扰项乙', '干扰项丙'],
        correct: 0,
        explanation: '答案解析',
        source: '原典或资料出处',
      },
    ],
  },
  null,
  2,
);

export function BaixiaoImportDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (body: {
    questions: BaixiaoQuestionData[];
  }) => Promise<BaixiaoImportResult>;
}) {
  const [draft, setDraft] = useState('');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [result, setResult] = useState<BaixiaoImportResult | null>(null);

  function close() {
    setResult(null);
    onClose();
  }

  async function readFile(file: File) {
    setBusy('reading');
    setError('');
    try {
      setDraft(await file.text());
      setFilename(file.name);
    } catch {
      setError('读取题库文件失败，请重选文件或粘贴内容。');
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    let candidate: unknown;
    try {
      candidate = JSON.parse(draft);
    } catch {
      setError('请提交有效的 JSON。');
      return;
    }
    const parsed = BaixiaoImportSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.join('.');
      setError(path ? `${path} · ${issue.message}` : issue.message);
      return;
    }
    setBusy('importing');
    setError('');
    try {
      setResult(await onImport(parsed.data));
      setDraft('');
      setFilename('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '题库导入失败。');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={close}
      title="批量导入题目"
      busy={!!busy}
      error={error}
      footer={
        result ? (
          <InkButton variant="primary" onClick={close}>
            完成
          </InkButton>
        ) : (
          <InkButton
            variant="primary"
            pending={busy === 'importing'}
            pendingLabel="正在导入…"
            disabled={!!busy || !draft.trim()}
            onClick={() => void submit()}
          >
            导入并启用
          </InkButton>
        )
      }
    >
      {result ? (
        <p role="status" className="text-teal">
          已导入并启用 <b className="font-mono">{result.inserted}</b> 题，跳过{' '}
          <b className="font-mono">{result.skipped}</b> 道已有启用题。
        </p>
      ) : (
        <div className="space-y-4">
          <div className="text-ink-secondary space-y-1 text-sm">
            <p>
              每批最多 350 题。可上传 JSON 文件或粘贴内容，正确选项从 0 编号。
            </p>
            <p>通过校验的题目立即启用。已冻结的当期题卷沿用原题。</p>
          </div>
          <div className="space-y-1">
            <label
              className="block text-sm font-medium"
              htmlFor="baixiao-import-file"
            >
              选择 JSON 文件
            </label>
            <input
              id="baixiao-import-file"
              type="file"
              className="block min-h-10 max-w-full text-sm"
              accept=".json,application/json"
              disabled={!!busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = '';
              }}
            />
            {filename && (
              <p className="text-ink-secondary text-sm break-all" role="status">
                已读取 {filename}
              </p>
            )}
          </div>
          <InkInput
            label="题库 JSON"
            multiline
            rows={7}
            className="font-mono"
            placeholder="粘贴题目 JSON"
            value={draft}
            disabled={!!busy}
            onChange={(value) => {
              setDraft(value);
              setError('');
              setFilename('');
            }}
          />
          <details className="text-ink-secondary text-sm">
            <summary className="cursor-pointer">查看导入格式</summary>
            <pre className="border-ink/15 bg-paper mt-2 overflow-auto border p-3 font-mono">
              {example}
            </pre>
          </details>
        </div>
      )}
    </AdminDialog>
  );
}

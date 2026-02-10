'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import { useState } from 'react';

type FeedbackType = 'bug' | 'feature' | 'balance' | 'other';

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug 反馈' },
  { value: 'feature', label: '功能建议' },
  { value: 'balance', label: '游戏平衡' },
  { value: 'other', label: '其他意见' },
];

const GITHUB_ISSUE_URL = 'https://github.com/churchT/daoyou/issues';

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>('bug');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const contentLength = content.trim().length;
  const canSubmit = contentLength >= 10 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: content.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: '反馈提交成功，感谢您的建议！' });
        setContent('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || '提交失败，请稍后重试',
        });
      }
    } catch {
      setMessage({ type: 'error', text: '提交失败，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InkPageShell
      title="意见反馈"
      subtitle="广纳良言，共筑仙途"
      backHref="/game"
    >
      <InkSection title="【提交反馈】">
        <div className="space-y-6">
          {/* 反馈类型选择 */}
          <div>
            <label className="mb-2 block font-semibold tracking-wide">
              反馈类型
            </label>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={`border px-3 py-1.5 text-sm transition-colors ${
                    type === item.value
                      ? 'border-crimson text-crimson bg-crimson/5'
                      : 'border-ink/20 text-ink-secondary hover:border-ink/40'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 反馈内容 */}
          <InkInput
            label="反馈内容"
            placeholder="请详细描述您遇到的问题或建议..."
            value={content}
            onChange={setContent}
            multiline
            rows={6}
            hint={`${contentLength} / 最少 10 字`}
            error={
              contentLength > 0 && contentLength < 10
                ? '反馈内容至少需要 10 个字'
                : undefined
            }
          />

          {/* 提交按钮 */}
          <div className="flex items-center gap-4">
            <InkButton
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? '提交中...' : '提交反馈'}
            </InkButton>

            {message && (
              <span
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-600' : 'text-crimson'
                }`}
              >
                {message.text}
              </span>
            )}
          </div>

          {/* GitHub 引导 */}
          <div className="border-ink/10 border-t pt-4">
            <p className="text-ink-secondary mb-2 text-sm">
              也可以前往 GitHub 提交 Issue，获得更快的响应：
            </p>
            <a
              href={GITHUB_ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-crimson text-sm hover:underline"
            >
              {GITHUB_ISSUE_URL} →
            </a>
          </div>
        </div>
      </InkSection>
    </InkPageShell>
  );
}

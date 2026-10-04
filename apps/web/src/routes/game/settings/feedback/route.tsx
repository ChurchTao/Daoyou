import { apiFetch } from '@app/lib/api/fetch';
import {
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkInput } from '@app/components/ui/InkInput';
import type { FeedbackType } from '@daoyou/contracts/feedback';
import { useState } from 'react';

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bug 反馈' },
  { value: 'feature', label: '功能建议' },
  { value: 'balance', label: '游戏平衡' },
  { value: 'other', label: '其他意见' },
];

const GITHUB_ISSUE_URL = 'https://github.com/ChurchTao/Daoyou/issues';

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
      const res = await apiFetch('/api/feedback', {
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
    <GameSceneFrame
      variant="lite"
      title="意见反馈"
      description="遇到问题或有改进建议，可以在这里告诉我们。"
      aside={
        <>
          <GameSceneAsideSection
            title="填写建议"
            className="text-sm leading-7"
            help={{
              title: '意见反馈填写建议',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>优先写清复现路径、预期与实际结果，便于尽快定位。</p>
                  <p>平衡性建议尽量附上场景、境界或资源阶段。</p>
                </div>
              ),
            }}
          />
          <GameSceneAsideSection title="GitHub Issue">
            <a
              href={GITHUB_ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-crimson text-sm hover:underline"
            >
              {GITHUB_ISSUE_URL} →
            </a>
          </GameSceneAsideSection>
        </>
      }
    >
      <div className="space-y-6">
        {/* 反馈类型选择 */}
        <div>
          <label className="mb-2 block font-semibold tracking-wide">
            反馈类型
          </label>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TYPES.map((item) => (
              <InkChoiceButton
                key={item.value}
                onClick={() => setType(item.value)}
                selected={type === item.value}
                className="py-1.5"
              >
                {item.label}
              </InkChoiceButton>
            ))}
          </div>
        </div>

        {/* 反馈内容 */}
        <InkInput
          label="反馈内容"
          placeholder="写下遇到的问题或你的建议"
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
            pending={submitting}
            pendingLabel="提交中……"
          >
            提交反馈
          </InkButton>

          {message && (
            <span
              className={`text-sm ${
                message.type === 'success' ? 'text-teal' : 'text-crimson'
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
    </GameSceneFrame>
  );
}

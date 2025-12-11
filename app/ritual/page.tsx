'use client';

import {
  InkActionGroup,
  InkButton,
  InkDivider,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

type RitualMode = 'skill' | 'adventure';

const modes: Record<
  RitualMode,
  {
    title: string;
    actionLabel: string;
    hint: string;
    example: string;
    apiEndpoint: string;
  }
> = {
  skill: {
    title: '【闭关 · 顿悟神通】',
    actionLabel: '开始顿悟',
    hint: '描述场景或愿景，AI 将生成对应神通。',
    example: '在雷劫中悟得一门攻防一体的雷遁之术',
    apiEndpoint: '/api/create-skill',
  },
  adventure: {
    title: '【奇遇 · 推演天机】',
    actionLabel: '触发奇遇',
    hint: '描述想去之地或目标，暂未接入 AI，但会记录意图。',
    example: '求一段药王谷秘境之旅，盼得疗伤灵药',
    apiEndpoint: '/api/generate-adventure',
  },
};

export default function RitualPage() {
  const { cultivator, refresh, note, isLoading } = useCultivatorBundle();
  const [mode, setMode] = useState<RitualMode>('skill');
  const [prompt, setPrompt] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  const currentMode = useMemo(() => modes[mode], [mode]);

  const handleSubmit = async () => {
    if (!cultivator) {
      pushToast({ message: '请先在首页觉醒灵根。', tone: 'warning' });
      return;
    }

    if (!prompt.trim() && mode !== 'adventure') {
      pushToast({ message: '请先输入你的意图。', tone: 'warning' });
      return;
    }

    setSubmitting(true);
    setStatus('天人感应，神游太虚……');

    try {
      const endpoint = currentMode.apiEndpoint;
      const body: Record<string, unknown> = {
        cultivatorId: cultivator.id,
      };

      if (mode === 'skill') {
        body.prompt = prompt;
      } else {
        body.intent = prompt;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '仪式失败');
      }

      let successMessage = '操作成功';
      if (mode === 'skill') {
        successMessage = `顿悟神通：${result.data.name}`;
      } else {
        successMessage = `奇遇：${result.data.adventure.name}`;
      }

      setStatus(successMessage);
      pushToast({ message: successMessage, tone: 'success' });
      setPrompt('');
      await refresh();
    } catch (error) {
      const failMessage =
        error instanceof Error
          ? `此法未成：${error.message}`
          : '仪式失败，请稍后再试。';
      setStatus(failMessage);
      pushToast({ message: failMessage, tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <p className="loading-tip">道场开启中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title={currentMode.title
        .replace(/[【】]/g, '')
        .split('·')[0]
        .trim()}
      subtitle={currentMode.title.split('·')[1]?.replace('】', '') || ''}
      backHref="/"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/">返回</InkButton>
          <span className="text-ink-secondary text-xs">心诚则灵，神念合一</span>
        </InkActionGroup>
      }
    >
      {/* 模式切换 */}
      <div className="mb-6 flex flex-wrap gap-x-3 gap-y-2">
        {Object.entries(modes).map(([key, config]) => {
          const isActive = mode === key;
          return (
            <InkButton
              key={key}
              variant={isActive ? 'primary' : 'default'}
              onClick={() => {
                setMode(key as RitualMode);
                setPrompt('');
                setStatus('');
              }}
              className={isActive ? 'font-semibold' : 'text-sm'}
            >
              {config.title
                .replace(/[【】]/g, '')
                .split('·')[0]
                .trim()}
            </InkButton>
          );
        })}
      </div>

      {/* 输入区域 */}
      <InkSection title="注入神识">
        <div className="mb-4">
          <InkList dense>
            <InkListItem title="提示" description={currentMode.hint} />
            <InkListItem
              title="示例"
              description={`“${currentMode.example}”`}
            />
          </InkList>
        </div>

        <InkInput
          multiline
          rows={6}
          placeholder="请在此输入你的意图……"
          value={prompt}
          onChange={(value) => setPrompt(value)}
          disabled={isSubmitting}
          hint="💡 Cmd/Ctrl + Enter 可快速提交"
        />

        <InkDivider />

        <InkActionGroup align="right">
          <InkButton
            onClick={() => {
              setPrompt('');
              setStatus('');
            }}
            disabled={isSubmitting}
          >
            重置
          </InkButton>
          <InkButton
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || (!prompt.trim() && mode !== 'adventure')}
          >
            {isSubmitting ? '运转灵力……' : currentMode.actionLabel}
          </InkButton>
        </InkActionGroup>
      </InkSection>

      {status && (
        <div className="mt-4">
          <InkNotice tone="info">{status}</InkNotice>
        </div>
      )}
    </InkPageShell>
  );
}

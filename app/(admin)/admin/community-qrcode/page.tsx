'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkInput } from '@/components/ui/InkInput';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

type LoadState = {
  sourceUrl: string;
  storedInDb: boolean;
};

export default function CommunityQrcodeAdminPage() {
  const { pushToast } = useInkUI();
  const [sourceUrl, setSourceUrl] = useState('');
  const [storedInDb, setStoredInDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/community-qrcode');
    const data = (await response.json()) as LoadState & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? '加载配置失败');
    }
    setSourceUrl(data.sourceUrl ?? '');
    setStoredInDb(Boolean(data.storedInDb));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message:
              error instanceof Error ? error.message : '加载配置失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, pushToast]);

  const submit = async () => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) {
      pushToast({ message: '请填写图片 URL', tone: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/community-qrcode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '保存失败');
      }
      setSourceUrl(data.sourceUrl ?? trimmed);
      setStoredInDb(true);
      setPreviewNonce((n) => n + 1);
      pushToast({ message: '已保存，玩家端将使用新图片地址', tone: 'success' });
      await load();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存失败',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          COMMUNITY
        </p>
        <h2 className="font-heading text-ink mt-2 text-3xl">交流群二维码</h2>
        <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
          填写 HTTPS 图片直链（与原先 R2 静态地址同类）。保存后即时生效，
          `/api/community/qrcode` 将代理该地址，无需重新发版。
        </p>
      </header>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6 space-y-4">
        {!storedInDb && !loading ? (
          <p className="text-ink-secondary text-sm">
            当前尚未写入数据库，玩家端显示的是代码内建的默认图。保存后即可改为仅由后台控制。
          </p>
        ) : null}

        <InkInput
          label="图片 URL（https）"
          value={sourceUrl}
          onChange={setSourceUrl}
          placeholder="https://..."
          disabled={loading || saving}
        />

        <div className="flex flex-wrap gap-3">
          <InkButton
            type="button"
            variant="primary"
            disabled={loading || saving}
            onClick={() => void submit()}
          >
            {saving ? '保存中…' : '保存'}
          </InkButton>
          <InkButton
            type="button"
            variant="secondary"
            disabled={loading || saving}
            onClick={() => void load()}
          >
            重新加载
          </InkButton>
        </div>
      </section>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <h3 className="text-ink text-lg font-semibold">预览（与玩家端一致）</h3>
        <p className="text-ink-secondary mt-2 text-sm">
          保存后会刷新下图；若浏览器仍显示旧图，可强制刷新页面。
        </p>
        <div className="border-ink/20 bg-paper mt-4 inline-block rounded-sm border border-dashed p-4">
          <Image
            src={`/api/community/qrcode?t=${previewNonce}`}
            alt="交流群二维码预览"
            width={280}
            height={280}
            unoptimized
            className="h-auto w-[280px] max-w-full"
          />
        </div>
      </section>
    </div>
  );
}

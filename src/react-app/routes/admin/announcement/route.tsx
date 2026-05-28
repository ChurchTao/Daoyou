import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useCallback, useEffect, useState } from 'react';

type LoadState = {
  announcement: string;
};

export default function AuthAnnouncementAdminPage() {
  const { pushToast } = useInkUI();
  const [announcement, setAnnouncement] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/announcement');
    const data = (await response.json()) as LoadState & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? '加载公告失败');
    }
    setAnnouncement(data.announcement ?? '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '加载公告失败',
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
    setSaving(true);
    try {
      const response = await fetch('/api/admin/announcement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '保存失败');
      }
      setAnnouncement(data.announcement ?? '');
      pushToast({
        message: data.announcement
          ? '已保存，认证页公告已更新'
          : '已保存，认证页公告已隐藏',
        tone: 'success',
      });
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
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          ANNOUNCEMENT
        </p>
        <h2 className="font-heading text-ink mt-2 text-3xl">游戏公告</h2>
        <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
          在这里维护登录、注册等认证页顶部的横幅公告。保存后立即生效；
          清空内容并保存，则玩家端会隐藏该横幅。
        </p>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-6">
        <InkInput
          label="公告内容"
          value={announcement}
          onChange={setAnnouncement}
          placeholder="例如：今晚 23:00 至 23:30 例行维护，请提前下线。"
          hint="支持纯文本，保存时会自动去掉首尾空格。"
          multiline
          rows={4}
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

        <div className="border-ink/20 bg-paper p-4">
          <p className="text-ink-secondary text-xs tracking-[0.16em]">
            当前生效公告
          </p>
          {announcement.trim() ? (
            <p className="text-ink mt-2 text-sm leading-7">
              {announcement.trim()}
            </p>
          ) : (
            <p className="text-ink-secondary mt-2 text-sm">
              当前未展示认证页公告横幅。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

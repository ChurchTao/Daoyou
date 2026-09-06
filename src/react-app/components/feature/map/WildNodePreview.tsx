import { useEffect, useState } from 'react';
export function WildNodePreview({ nodeId }: { nodeId: string }) {
  const [data, setData] = useState<{
    beastRealm: string;
    minLevel: number;
    maxLevel: number;
    remaining: number;
    species: { id: string; name: string }[];
  }>();
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`/api/combat-v6/wild/regions/${encodeURIComponent(nodeId)}`, {
      signal: abort.signal,
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setData(r.data);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [nodeId]);
  if (!data) return null;
  return (
    <div className="my-3 text-sm">
      <p>
        野生灵兽：{data.beastRealm}（{data.minLevel}～{data.maxLevel}级）
      </p>
      <p className="text-ink-secondary">
        {data.species.map((s) => s.name).join('、')} · 今日剩余{data.remaining}
        次
      </p>
    </div>
  );
}

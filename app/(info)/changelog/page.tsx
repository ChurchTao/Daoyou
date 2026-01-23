'use client';

import { InkModal, InkPageShell, InkSection } from '@/components/layout';
import { InkBadge } from '@/components/ui/InkBadge';
import { InkList, InkListItem } from '@/components/ui/InkList';
import { InkNotice } from '@/components/ui/InkNotice';
import { changelogs, type ChangelogItem } from '@/data/changelog';
import { useState } from 'react';

export default function ChangelogPage() {
  const [selectedVersion, setSelectedVersion] = useState<ChangelogItem | null>(
    null,
  );

  return (
    <InkPageShell
      title="版本志"
      subtitle="记载天地间每一次瞬息万变"
      backHref="/game"
    >
      <InkSection title="【历史记录】">
        <InkList>
          {changelogs.map((log) => (
            <div
              key={log.version}
              onClick={() => setSelectedVersion(log)}
              className="cursor-pointer hover:bg-ink/5 transition-colors rounded-lg"
            >
              <InkListItem
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{log.version}</span>
                    {log.type === 'major' && (
                      <InkBadge tone="danger">重大更新</InkBadge>
                    )}
                    {log.type === 'minor' && (
                      <InkBadge tone="accent">功能</InkBadge>
                    )}
                    {log.type === 'patch' && (
                      <InkBadge tone="default">修复</InkBadge>
                    )}
                  </div>
                }
                meta={<span className="text-sm opacity-60">{log.date}</span>}
                description={log.title || '日常维护更新'}
              />
            </div>
          ))}
        </InkList>
      </InkSection>

      <InkNotice>
        <div className="text-center text-sm opacity-60">
          版本更迭乃天道常理，道友且行且珍惜。
        </div>
      </InkNotice>

      <InkModal
        isOpen={!!selectedVersion}
        onClose={() => setSelectedVersion(null)}
        title={selectedVersion ? `${selectedVersion.version} 更新详情` : ''}
      >
        {selectedVersion && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between opacity-60 text-sm border-b border-ink/10 pb-2">
              <span>{selectedVersion.date}</span>
              <span>{selectedVersion.title}</span>
            </div>
            <ul className="space-y-2 list-disc list-inside text-ink/90">
              {selectedVersion.changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          </div>
        )}
      </InkModal>
    </InkPageShell>
  );
}

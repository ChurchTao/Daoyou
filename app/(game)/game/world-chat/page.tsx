'use client';

import { WorldChatPanel } from '@/components/feature/world-chat/WorldChatPanel';
import { InkPageShell, InkSection } from '@/components/layout';

export default function WorldChatPage() {
  return (
    <InkPageShell
      title="世界传音"
      subtitle="万界传音，八方同闻"
      backHref="/game"
    >
      <InkSection title="【传音列表】">
        <WorldChatPanel />
      </InkSection>
    </InkPageShell>
  );
}

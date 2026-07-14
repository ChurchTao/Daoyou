import { InkButton } from '@app/components/ui/InkButton';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { useState } from 'react';
import {
  SettingsField,
  SettingsMessage,
  SettingsSection,
} from './SettingsFields';
import { formatDateTime } from './utils';

export function GameSettingsTab() {
  const cultivator = useActiveCultivatorProfile();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const cultivatorId = cultivator?.id ?? '';

  const handleCopyCultivatorId = async () => {
    if (!cultivatorId) return;

    try {
      await navigator.clipboard.writeText(cultivatorId);
      setCopyMessage('已复制');
    } catch {
      setCopyMessage('复制失败');
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection>
        <SettingsField
          label="角色 ID"
          value={cultivatorId || '—'}
          mono
          action={
            cultivatorId ? (
              <InkButton variant="secondary" onClick={handleCopyCultivatorId}>
                复制
              </InkButton>
            ) : null
          }
        />
        <SettingsField
          label="角色创建时间"
          value={formatDateTime(cultivator?.createdAt)}
        />
      </SettingsSection>
      {copyMessage ? <SettingsMessage>{copyMessage}</SettingsMessage> : null}
    </div>
  );
}

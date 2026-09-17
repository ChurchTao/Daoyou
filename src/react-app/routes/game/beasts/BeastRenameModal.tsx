import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import {
  BEAST_NAME_MAX_LENGTH,
  BeastNameSchema,
} from '@shared/contracts/combatV6Beasts';
import { useState } from 'react';

export function BeastRenameModal({
  name,
  pending,
  close,
  save,
}: {
  name: string;
  pending: boolean;
  close: () => void;
  save: (name: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(name);
  const parsed = BeastNameSchema.safeParse(draft);
  return (
    <InkModal
      isOpen
      title="灵兽改名"
      onClose={() => {
        if (!pending) close();
      }}
      footer={
        <div className="flex justify-end gap-3">
          <InkButton variant="secondary" disabled={pending} onClick={close}>
            取消
          </InkButton>
          <InkButton
            variant="primary"
            pending={pending}
            pendingLabel="保存中…"
            disabled={!parsed.success}
            onClick={async () => {
              if (parsed.success && (await save(parsed.data))) close();
            }}
          >
            保存
          </InkButton>
        </div>
      }
    >
      <InkInput
        label="灵兽名字"
        value={draft}
        onChange={setDraft}
        disabled={pending}
        error={parsed.success ? undefined : parsed.error.issues[0]?.message}
      />
      <div className="text-ink-secondary mt-2 flex items-center justify-between gap-3 text-xs">
        <span>最多 7 字，敏感词将自动替换为 *</span>
        <span className="font-mono">
          {Array.from(draft.trim()).length}/{BEAST_NAME_MAX_LENGTH}
        </span>
      </div>
    </InkModal>
  );
}

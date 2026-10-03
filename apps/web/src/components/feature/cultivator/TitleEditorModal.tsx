import { InkModal } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';

interface TitleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTitle: string;
  setEditingTitle: (title: string) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function TitleEditorModal({
  isOpen,
  onClose,
  editingTitle,
  setEditingTitle,
  isSaving,
  onSave,
}: TitleEditorModalProps) {
  return (
    <InkModal isOpen={isOpen} onClose={onClose} title="定制名号">
      <div className="mt-4 space-y-4">
        <div className="text-sm opacity-80">
          给自己起个名号。
        </div>
        <InkInput
          value={editingTitle}
          onChange={setEditingTitle}
          placeholder="输入名号"
          hint="限 2-8 字"
        />
        <div className="mt-4 flex justify-end gap-2">
          <InkButton onClick={onClose}>取消</InkButton>
          <InkButton
            variant="primary"
            onClick={onSave}
            pending={isSaving}
            pendingLabel="镌刻中……"
          >
            确认修改
          </InkButton>
        </div>
      </div>
    </InkModal>
  );
}

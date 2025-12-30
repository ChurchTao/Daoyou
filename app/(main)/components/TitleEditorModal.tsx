'use client';

import { InkModal } from '@/components/layout';
import { InkButton, InkInput } from '@/components/ui';

interface TitleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTitle: string;
  setEditingTitle: (title: string) => void;
  isSaving: boolean;
  onSave: () => void;
}

/**
 * 称号编辑弹窗
 */
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
      <div className="space-y-4 mt-4">
        <div className="text-sm opacity-80">
          行走江湖，岂能无号？
          <br />
          请为自己起一个响亮的名号（如：乱星海虫魔）。
        </div>
        <InkInput
          value={editingTitle}
          onChange={setEditingTitle}
          placeholder="在此输入名号..."
          hint="限2-8字"
        />
        <div className="flex justify-end gap-2 mt-4">
          <InkButton onClick={onClose}>取消</InkButton>
          <InkButton variant="primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? '镌刻中...' : '确认修改'}
          </InkButton>
        </div>
      </div>
    </InkModal>
  );
}

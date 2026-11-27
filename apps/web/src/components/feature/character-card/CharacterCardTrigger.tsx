import { InkModal } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { useState, type ReactNode } from 'react';
import { CharacterCardContent } from './CharacterCardContent';

export function CharacterCardTrigger({
  id,
  name,
  children,
  onSelectFriend,
}: {
  id: string;
  name: string;
  children: ReactNode;
  onSelectFriend?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const close = () => {
    setOpen(false);
    setDetailOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={`查看${name}的名片`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="focus-visible:outline-crimson min-w-0 cursor-pointer p-0 text-left underline-offset-2 hover:underline"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <InkModal
        isOpen={open}
        onClose={close}
        title="道友名片"
        className="max-w-sm"
        manageFocus
        footer={
          <div className="flex justify-end">
            <InkButton variant="secondary" className="min-h-11" onClick={close}>
              关闭名片
            </InkButton>
          </div>
        }
      >
        <CharacterCardContent
          key={id}
          id={id}
          onDetailChange={setDetailOpen}
          actions={
            onSelectFriend && !detailOpen ? (
              <div className="border-ink/15 mt-3 border-t pt-2">
                <InkButton
                  className="min-h-11"
                  onClick={() => {
                    close();
                    onSelectFriend(id);
                  }}
                >
                  收录道友
                </InkButton>
              </div>
            ) : null
          }
        />
      </InkModal>
    </>
  );
}

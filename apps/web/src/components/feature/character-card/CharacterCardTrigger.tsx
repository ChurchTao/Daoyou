import { InkButton } from '@app/components/ui/InkButton';
import { useState, type ReactNode } from 'react';
import { CharacterCardContent } from './CharacterCardContent';
import { CharacterCardDialog } from './CharacterCardDialog';

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
  const close = () => setOpen(false);

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
      {open ? (
        <CharacterCardDialog onClose={close}>
          <CharacterCardContent
            key={id}
            id={id}
            actions={
              onSelectFriend ? (
                <InkButton
                  className="mt-2 min-h-11"
                  onClick={() => {
                    close();
                    onSelectFriend(id);
                  }}
                >
                  收录道友
                </InkButton>
              ) : null
            }
          />
        </CharacterCardDialog>
      ) : null}
    </>
  );
}

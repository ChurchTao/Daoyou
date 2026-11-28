import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkNotice } from '@app/components/ui/InkNotice';
import { cn } from '@app/lib/cn';
import { useState } from 'react';
import {
  CultivatorAvatar,
  type CultivatorPortrait,
} from '../cultivator/CultivatorAvatar';
import { useAvatarCollection, useAvatarEquip } from './avatarCollection';

type AvatarGalleryProps = {
  cultivator: CultivatorPortrait & { id: string };
  onClose: () => void;
  onEquipped?: (avatarId: string | null) => void;
  studioHref?: string;
};

export function AvatarGallery({
  cultivator,
  onClose,
  onEquipped,
  studioHref,
}: AvatarGalleryProps) {
  const collection = useAvatarCollection();
  const { equip, equipping, equipError } = useAvatarEquip(cultivator.id);
  const [equipped, setEquipped] = useState<string | null>();
  const [selected, setSelected] = useState<string | null>();
  const [large, setLarge] = useState(false);
  const active =
    equipped === undefined ? (cultivator.avatarId ?? null) : equipped;
  const candidate = selected === undefined ? active : selected;
  const entry = collection.avatars.find((avatar) => avatar.id === candidate);

  function select(id: string | null) {
    setSelected(id);
    setLarge(false);
  }

  async function apply() {
    const result = await equip(candidate);
    if (result) {
      setEquipped(result.avatarId);
      onEquipped?.(result.avatarId);
    }
  }

  return (
    <InkDetailDrawer
      isOpen
      title="头像收藏"
      size="md"
      onClose={onClose}
      footer={
        studioHref ? (
          <div className="flex justify-end">
            <InkButton className="min-h-11" href={studioHref} variant="primary">
              前往绘制
            </InkButton>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <section
          className="grid grid-cols-[minmax(5.4rem,1fr)_minmax(0,1.2fr)] items-center gap-4 sm:gap-6"
          aria-label="选中头像预览"
        >
          <CultivatorAvatar
            key={candidate ?? 'default'}
            {...cultivator}
            avatarId={candidate}
            size="384"
            className="bg-paper-2/60 aspect-square w-full"
          />
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-xl sm:text-2xl">
              {candidate ? '收藏墨像' : '默认墨像'}
            </h3>
            {candidate === active ? (
              <p className="text-ink-secondary text-xs leading-5">使用中</p>
            ) : null}
            {entry ? (
              <p className="text-ink max-h-20 overflow-y-auto text-sm leading-6 wrap-anywhere">
                {entry.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-2">
              {candidate !== active ? (
                <InkButton
                  className="min-h-11"
                  variant="primary"
                  pending={equipping}
                  pendingLabel="更换中……"
                  onClick={() => void apply()}
                >
                  启用头像
                </InkButton>
              ) : null}
              {candidate ? (
                <InkButton
                  className="min-h-11"
                  onClick={() => setLarge(!large)}
                >
                  {large ? '收起大图' : '查看大图'}
                </InkButton>
              ) : null}
            </div>
          </div>
        </section>
        {large && candidate ? (
          <CultivatorAvatar
            {...cultivator}
            avatarId={candidate}
            size="1024"
            className="mx-auto aspect-square w-full"
          />
        ) : null}
        {equipError ? (
          <p role="alert" className="text-crimson text-sm">
            {equipError}
          </p>
        ) : null}
        <section
          className="border-ink/15 space-y-3 border-t pt-4"
          aria-label="我的墨像"
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
            {[{ id: null, description: '默认墨像' }, ...collection.avatars].map(
              (avatar) => (
                <button
                  key={avatar.id ?? 'default'}
                  type="button"
                  aria-label={`${avatar.description}${active === avatar.id ? '，使用中' : ''}`}
                  aria-pressed={candidate === avatar.id}
                  disabled={equipping}
                  onClick={() => select(avatar.id)}
                  className={cn(
                    'focus-visible:outline-crimson relative min-w-0 cursor-pointer border p-0.5 text-left',
                    candidate === avatar.id
                      ? 'border-crimson'
                      : 'hover:border-wood/40 border-transparent',
                  )}
                >
                  <CultivatorAvatar
                    {...cultivator}
                    avatarId={avatar.id}
                    name={avatar.id ? cultivator.name : '默认头像'}
                    size="96"
                    lazy
                    decorative
                    className="bg-paper-2/60 aspect-square w-full"
                  />
                  <span className="text-ink-secondary block truncate px-1 pt-1 text-xs">
                    {avatar.id ? avatar.description : '默认墨像'}
                  </span>
                </button>
              ),
            )}
          </div>
          {!collection.view && !collection.error ? (
            <GameLoadingState variant="inline" message="正在读取收藏……" />
          ) : null}
          {collection.error ? (
            <InkNotice tone="warning">
              {collection.error}
              <InkButton className="min-h-11" onClick={collection.reload}>
                重试
              </InkButton>
            </InkNotice>
          ) : collection.view && !collection.avatars.length ? (
            <p className="text-ink-secondary text-sm leading-6">
              绘成的墨像会收在这里，可随时换用。
            </p>
          ) : null}
          {collection.nextCursor ? (
            <InkButton
              className="min-h-11"
              pending={collection.paging}
              onClick={() => void collection.nextPage()}
            >
              查看更多墨像
            </InkButton>
          ) : null}
        </section>
      </div>
    </InkDetailDrawer>
  );
}

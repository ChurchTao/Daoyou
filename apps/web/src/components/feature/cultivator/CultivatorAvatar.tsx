import { GameIcon } from '@app/components/ui/GameIcon';
import { GameImage } from '@app/components/ui/GameImage';
import { cn } from '@app/lib/cn';
import { clientEnv } from '@app/lib/env';
import type {
  AvatarSize,
  CultivatorPortraitRef,
} from '@daoyou/contracts/player/avatar';
import { useState, type ReactNode } from 'react';
import './cultivator-avatar.css';

export function AvatarArtwork({
  id,
  size,
  alt,
  className,
  fallback,
  lazy,
  reveal,
}: {
  id: string;
  size: AvatarSize;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  lazy?: boolean;
  reveal?: boolean;
}) {
  const { avatarImageOrigin } = clientEnv;
  const src = avatarImageOrigin
    ? `${avatarImageOrigin}/avatars/${encodeURIComponent(id)}/${size}.webp`
    : undefined;
  const [failed, setFailed] = useState<string>();
  const [loaded, setLoaded] = useState<string>();
  if (!src || failed === src)
    return (
      fallback ?? (
        <span className="text-ink-secondary grid size-full place-content-center px-1 text-center text-sm">
          {src ? (
            <button
              type="button"
              className="min-h-11 underline underline-offset-4"
              onClick={() => setFailed(undefined)}
            >
              重试加载头像
            </button>
          ) : (
            '头像暂不可用'
          )}
        </span>
      )
    );
  return (
    <GameImage
      src={src}
      alt={alt}
      onError={() => setFailed(src)}
      onLoad={reveal ? () => setLoaded(src) : undefined}
      data-revealing={reveal && loaded === src ? 'true' : undefined}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      draggable={false}
      className={cn(
        'block shrink-0 object-contain',
        reveal && 'avatar-artwork-reveal',
        className,
      )}
    />
  );
}

type AvatarAction = {
  label: string;
  onClick: () => void;
  variant?: 'label' | 'zoom';
};

export function AvatarFrame({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: AvatarAction;
}) {
  const frameClass = cn('cultivator-avatar-frame', className);
  if (!action) return <span className={frameClass}>{children}</span>;
  return (
    <button
      type="button"
      className={frameClass}
      data-action={action.variant ?? 'label'}
      aria-label={action.label}
      aria-haspopup="dialog"
      onClick={action.onClick}
    >
      {children}
      {action.variant === 'zoom' ? (
        <GameIcon value="icon:avatar-zoom" className="cultivator-avatar-zoom" />
      ) : (
        <span className="cultivator-avatar-action">{action.label}</span>
      )}
    </button>
  );
}

export type CultivatorPortrait = CultivatorPortraitRef & {
  name: string;
};

type CultivatorAvatarProps = CultivatorPortrait & {
  className?: string;
  size?: AvatarSize;
  lazy?: boolean;
  decorative?: boolean;
};

export function CultivatorAvatar({
  avatarId,
  gender,
  name,
  className,
  size = '384',
  lazy,
  decorative,
}: CultivatorAvatarProps) {
  const alt = decorative ? '' : `${name}的墨像`;
  const imageClass = cn('size-full', className);
  const fallback = (
    <GameIcon
      purpose="artwork"
      value={
        gender === '女'
          ? 'icon:cultivator-female-avatar'
          : 'icon:cultivator-male-avatar'
      }
      label={alt}
      className={imageClass}
    />
  );
  return avatarId ? (
    <AvatarArtwork
      id={avatarId}
      size={size}
      alt={alt}
      className={imageClass}
      fallback={fallback}
      lazy={lazy}
    />
  ) : (
    fallback
  );
}

export function FramedCultivatorAvatar({
  action,
  className,
  ...portrait
}: CultivatorAvatarProps & { action?: AvatarAction }) {
  return (
    <AvatarFrame className={className} action={action}>
      <CultivatorAvatar
        {...portrait}
        decorative={!!action || portrait.decorative}
      />
    </AvatarFrame>
  );
}

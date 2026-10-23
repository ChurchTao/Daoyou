import { GameIcon } from '@app/components/ui/GameIcon';

export function BeastLockTag({ isLocked }: { isLocked?: boolean }) {
  if (!isLocked) return null;
  return (
    <span
      className="text-ink-secondary inline-flex shrink-0 items-center gap-1 text-xs"
      title="已锁定，不能融合、寄售、回收或放生"
    >
      <GameIcon value="🔒" />
      已锁定
    </span>
  );
}

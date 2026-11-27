import { cn } from '@app/lib/cn';

export function FriendOnlineDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('bg-teal size-2.5 shrink-0 rounded-full', className)}
    />
  );
}

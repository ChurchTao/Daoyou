import { cn } from '@app/lib/cn';
import './mystery-scenes.css';

export function MysterySceneArt({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn(
        'mystery-scene-art pointer-events-none w-full object-cover object-bottom',
        className,
      )}
    />
  );
}

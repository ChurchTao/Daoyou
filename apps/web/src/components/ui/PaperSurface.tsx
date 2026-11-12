import { cn } from '@app/lib/cn';
import { useGameSettings, type PaperTexture } from '@app/lib/game-setting';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import './PaperSurface.css';

type PaperTag = 'div' | 'main' | 'section' | 'aside' | 'article' | 'span';

type PaperSurfaceProps = {
  as?: PaperTag;
  /** Override only for paper samples; regular surfaces follow game settings. */
  texture?: PaperTexture;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>;

export const PaperSurface = forwardRef<HTMLDivElement, PaperSurfaceProps>(
  function PaperSurface({ as, texture, className, children, ...rest }, ref) {
    const { paperTexture } = useGameSettings();
    const Tag = as ?? 'div';

    return (
      <Tag
        ref={ref as never}
        className={cn('paper-surface relative', className)}
        data-paper-texture={texture ?? paperTexture}
        {...rest}
      >
        {children}
      </Tag>
    );
  },
);

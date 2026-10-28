import { cn } from '@app/lib/cn';
import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import './PaperSurface.css';
import {
  paperStrokeDarkMask,
  paperStrokeLightMask,
} from './paperSurfaceFibers';

type PaperTag = 'div' | 'main' | 'section' | 'aside' | 'article';

type PaperSurfaceProps = {
  as?: PaperTag;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>;

export const PaperSurface = forwardRef<HTMLDivElement, PaperSurfaceProps>(
  function PaperSurface({ as, className, children, ...rest }, ref) {
  const Tag = as ?? 'div';

  return (
    <Tag
      ref={ref as never}
      className={cn('paper-surface relative', className)}
      {...rest}
    >
      <i className="paper-surface__layer paper-surface__mottle" aria-hidden="true" />
      <i className="paper-surface__layer paper-surface__fibre-d" aria-hidden="true" />
      <i className="paper-surface__layer paper-surface__fibre-l" aria-hidden="true" />
      <i className="paper-surface__layer paper-surface__grain-d" aria-hidden="true" />
      <i className="paper-surface__layer paper-surface__grain-l" aria-hidden="true" />
      <i
        className="paper-surface__layer paper-surface__stroke-d"
        style={{ '--paper-stroke': paperStrokeDarkMask } as CSSProperties}
        aria-hidden="true"
      />
      <i
        className="paper-surface__layer paper-surface__stroke-l"
        style={{ '--paper-stroke': paperStrokeLightMask } as CSSProperties}
        aria-hidden="true"
      />
      {children}
    </Tag>
  );
  },
);

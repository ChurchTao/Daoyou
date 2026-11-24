import { useBodyScrollLock } from '@app/lib/hooks/useBodyScrollLock';
import { useOverlayViewport } from '@app/lib/hooks/useOverlayViewport';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

export function ContestModal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useBodyScrollLock(open);
  useOverlayViewport(dialog, open);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    heading.current?.focus();
    return () => element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="contest-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      {open && (
        <div className="contest-modal-layout">
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <div className="contest-modal-body">{children}</div>
          <footer className="contest-modal-actions">{footer}</footer>
        </div>
      )}
    </dialog>
  );
}

export function ContestScoringRules() {
  return (
    <dl className="contest-rule-list">
      <div>
        <dt>上榜条件</dt>
        <dd>
          至少炼出一枚同时满足本期药效和丹毒要求的丹药。未达标或未成丹的炉次不计分，材料、炉气和炉次照扣。
        </dd>
      </div>
      <div>
        <dt>单炉得分</dt>
        <dd>
          主药效最高 <b className="font-mono">50</b> 分、品质{' '}
          <b className="font-mono">15</b> 分、产量与品相各{' '}
          <b className="font-mono">10</b> 分、用时{' '}
          <b className="font-mono">5</b>{' '}
          分。用时从入场算到开炉，越早开炉，用时分越高。稳度、纯度和火候影响品相。品相分最多浮动{' '}
          <b className="font-mono">1</b> 分。
        </dd>
      </div>
      <div>
        <dt>总分与排名</dt>
        <dd>
          取最高分的一炉，加上全场节材（最多 8 分）和节气（最多 2
          分）。总分相同先比药效分，药效分也相同则用料少者在前。
        </dd>
      </div>
      <div>
        <dt>投料限制</dt>
        <dd>
          每炉投 <b className="font-mono">2 至 4</b> 味、合计{' '}
          <b className="font-mono">3 至 5</b> 份，同味最多{' '}
          <b className="font-mono">2</b> 份。
        </dd>
      </div>
    </dl>
  );
}

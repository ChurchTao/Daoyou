import { InkNotice } from '@app/components/ui';
import { createElement } from 'react';
import type { SectTaskActionRendererProps } from './SectTaskActions';
import { getSectTaskActionRenderer } from './sectTaskActionRegistry';

export type {
  SectTaskActionRendererProps,
  SectTaskViewAction,
} from './SectTaskActions';

export function SectTaskActionRenderer(props: SectTaskActionRendererProps) {
  const Renderer = getSectTaskActionRenderer(props.action.renderer);
  if (!Renderer)
    return (
      <InkNotice className="mt-3">这桩事务眼下无法办理，请稍后再试。</InkNotice>
    );
  return createElement(Renderer, props);
}

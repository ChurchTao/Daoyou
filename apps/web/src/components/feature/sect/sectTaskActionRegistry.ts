import { sectTaskRendererRegistry } from '@app/lib/sect/presentation/compositionRoot';
import type { ComponentType } from 'react';
import type { SectTaskActionRendererProps } from './SectTaskActions';

export function registerSectTaskActionRenderer(
  key: string,
  renderer: ComponentType<SectTaskActionRendererProps>,
): void {
  sectTaskRendererRegistry().register({
    sectId: '*',
    actions: [{ key, renderer }],
  });
}

export function getSectTaskActionRenderer(
  key: string,
): ComponentType<SectTaskActionRendererProps> | undefined {
  return sectTaskRendererRegistry().action(key);
}

export function hasSectTaskActionRenderer(key: string): boolean {
  return sectTaskRendererRegistry().hasAction(key);
}

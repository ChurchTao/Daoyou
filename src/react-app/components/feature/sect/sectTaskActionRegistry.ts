import type { ComponentType } from 'react';
import type { SectTaskActionRendererProps } from './SectTaskActions';
import { sectPresentationRegistry } from '@app/lib/sect/presentation/compositionRoot';

export function registerSectTaskActionRenderer(
  key: string,
  renderer: ComponentType<SectTaskActionRendererProps>,
): void {
  sectPresentationRegistry().register({
    sectId: '*',
    actions: [{ key, renderer }],
  });
}

export function getSectTaskActionRenderer(
  key: string,
): ComponentType<SectTaskActionRendererProps> | undefined {
  return sectPresentationRegistry().action(key);
}

export function hasSectTaskActionRenderer(key: string): boolean {
  return sectPresentationRegistry().hasAction(key);
}

import { sectTaskRendererRegistry } from '@app/lib/sect/presentation/compositionRoot';
import type { SectTaskActionOutcome } from '@shared/contracts/sect';
import { createElement } from 'react';
import type { ZodType } from 'zod';

export {
  readBattleOutcome,
  readSweepSessionOutcome,
} from '@app/lib/sect/presentation/core/module';
export type {
  DecodedSectTaskOutcome,
  SectOutcomeDecodeResult,
} from '@app/lib/sect/presentation/core/registry';

export function registerSectTaskOutcome<T>(
  renderer: string,
  schema: ZodType<T>,
  component: import('react').ComponentType<
    import('@app/lib/sect/presentation/core/registry').SectOutcomeRendererProps<T>
  >,
): void {
  sectTaskRendererRegistry().register({
    sectId: '*',
    outcomes: [
      {
        key: renderer,
        schema,
        renderer: (props) =>
          createElement(component, {
            task: props.task,
            data: props.data as T,
          }),
      },
    ],
  });
}

export function decodeSectTaskOutcome(outcome: SectTaskActionOutcome) {
  return sectTaskRendererRegistry().decode(outcome);
}

export function hasSectTaskOutcomeRenderer(renderer: string): boolean {
  return sectTaskRendererRegistry().hasOutcome(renderer);
}

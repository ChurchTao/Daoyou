import { sectPresentationRegistry } from '@app/lib/sect/presentation/compositionRoot';
import type { SectTaskActionOutcome } from '@shared/contracts/sect';
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
): void {
  sectPresentationRegistry().register({
    sectId: '*',
    outcomes: [{ key: renderer, schema }],
  });
}

export function decodeSectTaskOutcome(outcome: SectTaskActionOutcome) {
  return sectPresentationRegistry().decode(outcome);
}

export function hasSectTaskOutcomeRenderer(renderer: string): boolean {
  return sectPresentationRegistry().hasOutcome(renderer);
}

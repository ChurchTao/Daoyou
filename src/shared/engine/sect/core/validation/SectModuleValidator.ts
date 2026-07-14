import type { SectModule } from '../plugin';
import { SectCompilationRule } from './SectCompilationRule';
import { SectCompositionRule } from './SectCompositionRule';
import { SectDefinitionRule } from './SectDefinitionRule';
import { ValidationPipeline } from './ValidationPipeline';

const pipeline = new ValidationPipeline<SectModule>([
  new SectDefinitionRule(),
  new SectCompositionRule(),
  new SectCompilationRule(),
]);

export function assertSectModule(module: SectModule): void {
  pipeline.validate(module);
}

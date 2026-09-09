import type { SectModule } from '../plugin';
import { SectDefinitionRule } from './SectDefinitionRule';
import { ValidationPipeline } from './ValidationPipeline';

const pipeline = new ValidationPipeline<SectModule>([new SectDefinitionRule()]);

export function assertSectModule(module: SectModule): void {
  pipeline.validate(module);
}

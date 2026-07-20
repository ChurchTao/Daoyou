import { CORE_SECT_PRESENTATION_PLUGIN } from './core/module';
import {
  SectPresentationRegistry,
  type SectPresentationModule,
  type SectPresentationPluginManifest,
} from './core/registry';
import { LINGXIAO_PRESENTATION_PLUGIN } from './lingxiao/module';
import { PRODUCTION_SECT_IDS } from '@shared/engine/sect/content/productionRuntime';

const registry = new SectPresentationRegistry(PRODUCTION_SECT_IDS);
let initialized = false;

export function initializeSectPresentationPlugins(
  manifests: readonly SectPresentationPluginManifest[] = [
    CORE_SECT_PRESENTATION_PLUGIN,
    LINGXIAO_PRESENTATION_PLUGIN,
  ],
): SectPresentationRegistry {
  if (!initialized) {
    for (const manifest of manifests) registry.register(manifest);
    initialized = true;
  }
  return registry;
}

export function sectPresentationRegistry(): SectPresentationRegistry {
  return initializeSectPresentationPlugins();
}

export function registerSectPresentation(module: SectPresentationModule): void {
  sectPresentationRegistry().register({
    sectId: module.sectId,
    presentation: module,
  });
}

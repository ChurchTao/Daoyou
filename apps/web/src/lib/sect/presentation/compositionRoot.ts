import { PRODUCTION_SECT_IDS } from '@daoyou/game-rules/sect-organization/production';
import { CORE_SECT_TASK_RENDERER_PLUGIN } from './core/module';
import {
  SectTaskRendererRegistry,
  type SectTaskRendererPluginManifest,
} from './core/registry';

const registry = new SectTaskRendererRegistry(PRODUCTION_SECT_IDS);
let initialized = false;

export function initializeSectTaskRendererPlugins(
  manifests: readonly SectTaskRendererPluginManifest[] = [
    CORE_SECT_TASK_RENDERER_PLUGIN,
  ],
): SectTaskRendererRegistry {
  if (!initialized) {
    for (const manifest of manifests) registry.register(manifest);
    initialized = true;
  }
  return registry;
}

export function sectTaskRendererRegistry(): SectTaskRendererRegistry {
  return initializeSectTaskRendererPlugins();
}

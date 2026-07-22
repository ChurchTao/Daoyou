import type {
  SectBuildBuilder,
  SectProjectionContext,
} from '../../../../core';
import { compileTianyanBuild } from '../../base/TianyanBaseCompiler';
import type { TianyanBuildSettings } from '../../shared/buildFacades';

export function compileHetuBuild(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
  settings: TianyanBuildSettings,
): void {
  compileTianyanBuild(context, builder, settings);
}

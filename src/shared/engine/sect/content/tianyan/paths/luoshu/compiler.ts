import type {
  SectBuildBuilder,
  SectProjectionContext,
} from '../../../../core';
import { compileTianyanBuild } from '../../base/TianyanBaseCompiler';
import type { TianyanBuildSettings } from '../../shared/buildFacades';

export function compileLuoshuBuild(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
  settings: TianyanBuildSettings,
): void {
  compileTianyanBuild(context, builder, settings);
}

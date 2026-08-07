import { buildPresetUnits } from './presets/presetUnits';
import { buildLibraryUnits, buildLibrary5v5Units } from './library/presetLibraryUnits';
import { TeamBattleEngine } from './TeamBattleEngine';
import type { TeamBattleRecord } from './types';

export interface RunPresetOptions {
  seed?: string | number;
  maxTurns?: number;
  /** 预设集：'default' 基础技能，'library' 2v2 技能库，'library5v5' 5v5 技能库（10角色） */
  preset?: 'default' | 'library' | 'library5v5';
}

/**
 * 运行预设的团队战斗模拟（2v2 或 5v5）。
 *
 * 纯 CPU 计算，不依赖 DB/Redis/LLM。
 * 每次调用都创建新的单位实例和引擎实例（避免状态泄漏）。
 *
 * preset='library' 使用 2v2 技能库测试存档。
 * preset='library5v5' 使用 5v5 技能库测试存档（10 角色不对称阵容）。
 */
export function runPresetTeamBattle(opts: RunPresetOptions = {}): TeamBattleRecord {
  let units;
  if (opts.preset === 'library5v5') {
    units = buildLibrary5v5Units();
  } else if (opts.preset === 'library') {
    units = buildLibraryUnits();
  } else {
    units = buildPresetUnits();
  }
  const engine = new TeamBattleEngine(units, {
    seed: opts.seed,
    maxTurns: opts.maxTurns,
  });
  try {
    return engine.run();
  } finally {
    engine.destroy();
  }
}

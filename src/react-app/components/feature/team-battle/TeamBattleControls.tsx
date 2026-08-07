import { useState } from 'react';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import { InkButton } from '@app/components/ui/InkButton';

export type TeamBattlePreset = 'default' | 'library' | 'library5v5';

interface TeamBattleControlsProps {
  onRun: (opts: { seed?: string; maxTurns?: number; preset?: TeamBattlePreset }) => void;
  loading: boolean;
  /** 受控 preset（供外部 Roster 联动） */
  preset?: TeamBattlePreset;
  onPresetChange?: (preset: TeamBattlePreset) => void;
}

export function TeamBattleControls({ onRun, loading, preset: presetProp, onPresetChange }: TeamBattleControlsProps) {
  const [seed, setSeed] = useState('');
  const [internalPreset, setInternalPreset] = useState<TeamBattlePreset>('library5v5');

  const preset = presetProp ?? internalPreset;
  const setPreset = (p: TeamBattlePreset) => {
    setInternalPreset(p);
    onPresetChange?.(p);
  };

  const handleRun = () => {
    const trimmed = seed.trim();
    onRun({
      seed: trimmed || undefined,
      preset,
    });
  };

  return (
    <div className="border-ink/15 border-dashed border bg-bgpaper/50 flex flex-wrap items-end gap-4 p-4">
      <div className="min-w-40 flex-1">
        <InkInput
          label="随机种子"
          placeholder="留空随机"
          value={seed}
          onChange={(v) => setSeed(v)}
          variant="underlined"
          size="sm"
        />
      </div>
      <div className="min-w-48 flex-1">
        <InkSelect
          label="阵容"
          value={preset}
          onChange={(v) => setPreset(v as TeamBattlePreset)}
          variant="underlined"
          size="sm"
        >
          <option value="library5v5">五五技能库（十角色不对称阵容）</option>
          <option value="library">二二技能库（光环/追击/蓄力/嘲讽）</option>
          <option value="default">二二基础预设（攻击光环/连击/反击）</option>
        </InkSelect>
      </div>
      <InkButton
        variant="primary"
        onClick={handleRun}
        pending={loading}
        pendingLabel="模拟中"
      >
        开战
      </InkButton>
    </div>
  );
}

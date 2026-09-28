type StatusChoice = { kind: string; statusId?: string; label: string };
type TargetStatusChoice = StatusChoice & {
  side: 'ally' | 'enemy';
  ownedBySelf: boolean;
};

type StatusChoices = {
  self: readonly StatusChoice[];
  target: readonly TargetStatusChoice[];
};

/** Only combat states with a useful player-facing tactical meaning are editable. */
const choices: Record<string, StatusChoices> = {
  lingxiao: {
    self: [{ kind: 'lingxiao.clarity', label: '剑心通明' }],
    target: [
      {
        kind: 'lingxiao.sword_aura',
        label: '破极剑意',
        side: 'ally',
        ownedBySelf: false,
      },
      {
        kind: 'lingxiao.confuse',
        label: '剑龙吟',
        side: 'enemy',
        ownedBySelf: false,
      },
    ],
  },
  youdu: {
    self: [{ kind: 'youdu.insight', label: '洞幽法眼' }],
    target: [
      {
        kind: 'youdu.poison',
        label: '魂毒',
        side: 'enemy',
        ownedBySelf: false,
      },
      {
        kind: 'youdu.siphon',
        label: '摄魂',
        side: 'enemy',
        ownedBySelf: false,
      },
      { kind: 'youdu.slow', label: '滞魂', side: 'enemy', ownedBySelf: false },
      {
        kind: 'youdu.soul_seal',
        label: '拘灵',
        side: 'enemy',
        ownedBySelf: false,
      },
    ],
  },
  wuxiang: {
    self: [
      { kind: 'wuxiang.form', label: '佛相或魔相' },
      {
        kind: 'wuxiang.form',
        statusId: 'wuxiang.status.buddha',
        label: '佛相',
      },
      { kind: 'wuxiang.form', statusId: 'wuxiang.status.demon', label: '魔相' },
    ],
    target: [
      {
        kind: 'wuxiang.breach',
        label: '自己施加的破绽',
        side: 'enemy',
        ownedBySelf: true,
      },
      {
        kind: 'wuxiang.vow',
        label: '自己结下的本愿印',
        side: 'ally',
        ownedBySelf: true,
      },
    ],
  },
  tianyan: {
    self: [
      { kind: 'tianyan.status.mark', label: '任意法印' },
      {
        kind: 'tianyan.status.mark',
        statusId: 'tianyan.status.mark.wood',
        label: '木印',
      },
      {
        kind: 'tianyan.status.mark',
        statusId: 'tianyan.status.mark.fire',
        label: '火印',
      },
      {
        kind: 'tianyan.status.mark',
        statusId: 'tianyan.status.mark.earth',
        label: '土印',
      },
      {
        kind: 'tianyan.status.mark',
        statusId: 'tianyan.status.mark.metal',
        label: '金印',
      },
      {
        kind: 'tianyan.status.mark',
        statusId: 'tianyan.status.mark.water',
        label: '水印',
      },
    ],
    target: [],
  },
  jiujie: {
    self: [{ kind: 'jiujie.status.guardian', label: '天罡护体' }],
    target: [
      {
        kind: 'jiujie.status.electric',
        label: '自己留下的雷印',
        side: 'enemy',
        ownedBySelf: true,
      },
      {
        kind: 'jiujie.status.red',
        label: '自己留下的赤雷印',
        side: 'enemy',
        ownedBySelf: true,
      },
      {
        kind: 'jiujie.status.confuse',
        label: '乱神雷咒',
        side: 'enemy',
        ownedBySelf: false,
      },
      {
        kind: 'jiujie.status.suppress',
        label: '禁诀敕令',
        side: 'enemy',
        ownedBySelf: false,
      },
    ],
  },
};

export function autoStatusChoices(pathId: string): StatusChoices {
  const sectChoices = choices[pathId.split('.path.')[0]] ?? {
    self: [],
    target: [],
  };
  if (pathId === 'wuxiang.path.compassion')
    return {
      ...sectChoices,
      target: sectChoices.target.filter(
        (choice) => choice.kind !== 'wuxiang.breach',
      ),
    };
  if (pathId === 'wuxiang.path.wrath')
    return {
      ...sectChoices,
      target: sectChoices.target.filter(
        (choice) => choice.kind !== 'wuxiang.vow',
      ),
    };
  if (pathId === 'jiujie.path.law')
    return {
      ...sectChoices,
      target: sectChoices.target.filter(
        (choice) =>
          choice.kind !== 'jiujie.status.electric' &&
          choice.kind !== 'jiujie.status.red',
      ),
    };
  return sectChoices;
}

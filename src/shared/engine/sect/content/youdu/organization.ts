import type { SectOrganizationTheme } from '../../core';

export const YOUDU_ORGANIZATION_THEME: SectOrganizationTheme = {
  taskPresentation: {
    gate_sweep: {
      title: '巡查魂灯',
      description: '沿黑水石径巡查魂灯，记下倒影与行人错开的每一瞬。',
      actionLabel: '前往黑水巡灯',
    },
    mine_patrol: {
      title: '平息界隙回声',
      description: '前往黑水阴脉，收束从界隙中逸出的失控念灵。',
      actionLabel: '前往阴脉',
    },
    pill_delivery: {
      title: '返照药契',
      description: '提交一枚有效丹药，供返照室安定离魂弟子的神识。',
      actionLabel: '交付定魂丹药',
    },
    artifact_delivery: {
      title: '镇魂器契',
      description: '提交一件未装备的凡品以上法宝，用于修补镇魂仪轨。',
      actionLabel: '交付镇魂法器',
    },
    weekly_diligence: {
      title: '巡灯周录',
      description: '一周完成五次招魂司勤务，补全黑水沿岸的巡灯簿。',
      actionLabel: '查看巡灯簿',
    },
    weekly_tournament: {
      title: '照影校术',
      description: '在照影场校验招魂、镇魄与送魂之法。',
      actionLabel: '进入照影场',
    },
    weekly_bounty: {
      title: '失名悬契',
      description: '追查夺舍邪修、役魂商贩或伪造招魂契者留下的线索。',
      actionLabel: '领取悬契',
    },
    elder_trial: {
      title: '七灯问名',
      description: '随引魂师穿过七灯，守住自己的姓名与归路。',
      actionLabel: '踏入七灯阵',
    },
  },
  shopGrants: {
    outer_qinglu: {
      name: '魂灯油',
      description: '取自阴木灵脂，可供魂灯安静燃烧一夜。',
    },
    outer_recovery_pill: {
      name: '渡夜回气丹',
      description: '招魂司值夜所用的制式回气丹。',
    },
    inner_ironwood: {
      name: '黑水砂',
      description: '黑水河床沉积的细砂，可稳定丹器中的阴阳流转。',
    },
    inner_healing_pill: {
      name: '返魂止血丹',
      description: '返照室储备的疗伤丹药，只救生身，不拘魂魄。',
    },
    true_cloud_ore: {
      name: '镇魂铁',
      description: '黑水阴脉中沉积的旧铁，可稳固器物神韵。',
    },
    true_spirit_pill: {
      name: '返照定魂丹',
      description: '真传弟子渡魂远行前服用的高阶回气丹。',
    },
  },
  opponents: {
    mine_patrol: { title: '阴脉回声', name: '失控念灵' },
    weekly_tournament: { title: '照影校术', name: '照影试魂傀' },
    weekly_bounty: { title: '失名悬契', name: '役魂商贩残影' },
    elder_trial: { title: '七灯问名', name: '引魂师法身' },
  },
  facilityNames: {
    archive: '三魂阁',
    cultivation_room: '返照室',
    workshop: '镇铁炉',
    spirit_vein: '黑水阴脉',
    herb_garden: '返照香圃',
  },
  stipendGrantNames: {
    herb: '魂灯油',
    trueHerb: '返照香',
    innerMaterial: '黑水砂',
  },
};

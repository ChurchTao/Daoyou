# Battle Log Copywriting Style

## Style Positioning

- Main style: concise, tactical, information-first.
- Accent style: light web-novel flavor only on highlight events.
- Forbidden: English terms, emoji, internet slang.

## Symbol Rules

- Unit name: `「姓名」`
- Skill name: `《技能名》`
- Status/Buff name: `「状态名」`
- Structural lines: `【战斗开始】`, `【第 N 回合】`, `【持续】`

## Number Rules

- Use Arabic numerals with thousands separators.
- Examples:
  - `造成 1,280 点伤害`
  - `恢复 12,800 点气血`
- Keep unit words explicit: `点伤害`, `点气血`, `点真元`, `点护盾`.

## Core Sentence Order

Use one-line aggregation per target:

1. actor + action
2. hit result or main effect (damage/heal/shield)
3. status changes (apply/dispel)
4. special outcomes (interrupt, reflect, cooldown modify, tag trigger)
5. terminal outcome (death prevent or death)

Death prevent always takes precedence over death text.

## Canonical Templates

- Basic attack hit:
  - `「甲」发起攻击，对「乙」造成 100 点伤害`
- Skill hit:
  - `「甲」施放《火球术》，对「乙」造成 1,280 点伤害`
- Critical:
  - `...造成 1,280 点伤害（暴击）！`
- Shield absorb:
  - `...造成 800 点伤害（抵扣护盾 300 点，护盾已破碎）`
- Buff apply:
  - `...并施加「灼烧」×2（3 回合）`
- Pure buff:
  - `「甲」施放《咒印术》，对「乙」施加「灼烧」×2（3 回合）`
- Dodge/resist:
  - `「甲」施放《火球术》，被「乙」闪避了！`
  - `「甲」施放《镇魂咒》，被「乙」抵抗了！`
- DOT/HOT:
  - `【持续】「乙」身上的「灼烧」发作，造成 320 点伤害`
  - `【持续】「乙」身上的「回春」生效，恢复 260 点气血`
- Dispel:
  - `「甲」施放《净化术》，清除了「乙」身上的「灼烧」、「中毒」`
- Interrupt:
  - `「甲」施放《封魔击》，打断了「乙」的《火球术》！`
- Death prevent:
  - `...，「乙」触发免死效果，保住了性命！`
- Death:
  - `...，「乙」被击败！`

## Multi-Target Rule

- One target per line.
- Keep the same sentence skeleton for each line.
- Do not mix multiple target outcomes into one sentence.

## Player View vs Tactical View

- Player view:
  - Keep conclusion-oriented text.
  - Do not include remain HP/shield values.
- Tactical/AI/Debug view:
  - Keep structured numeric details and internal fields.

## Extension Rules

When adding a new effect type:

1. define one canonical hard-style phrase.
2. optionally add one light accent phrase for highlights.
3. keep symbol and number rules unchanged.
4. add/adjust tests in `engine/battle-v5/tests/systems/log/LogPresenter.test.ts`.

## QA Checklist

- Every action line has actor + action + target.
- Number values are complete and formatted.
- Symbol wrappers are consistent.
- No mixed English words.
- No emoji or internet slang.
- No duplicate conflicting outcomes in one line.
- Death prevent suppresses death text.

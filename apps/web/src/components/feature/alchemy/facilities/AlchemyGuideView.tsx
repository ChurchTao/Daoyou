import { InkButton } from '@app/components/ui';
import { AlchemyToolWorkspace } from '../AlchemyToolWorkspace';

const SECTIONS = [
  {
    title: '初识炼丹',
    body: '一炉炼丹只需在丹炉内完成材料准备、炼制预览和确认炼制。药柜、玉简和炉理碑都是可选的辅助设施。',
  },
  {
    title: '随心炼丹',
    body: '投入材料并填写明确的炼制目标，丹炉会根据材料药性与目标生成丹药，也可能由此获得新丹方。',
  },
  {
    title: '丹方炼制',
    body: '选择已保存的丹方后再添加材料。炼制预览会说明当前材料与丹方是否契合。',
  },
  {
    title: '药蕴与批次',
    body: '材料数量与品质汇成药蕴。药蕴会分结成主丹和副丹，同一炉可能出现多个品质与品相批次。',
  },
  {
    title: '品质与品相',
    body: '品质代表丹药层次，品相代表同品质下的成丹完整程度。预览只能显示大致倾向，炼制完成后才能看到最终结果。',
  },
  {
    title: '丹毒与炉况',
    body: '燥烈、冲突或过杂的配伍会提高损耗与风险。炼制预览会列出无法继续的原因和需要留意的问题。',
  },
  {
    title: '常见失败原因',
    body: '材料不足、灵石不足、炼制目标为空、未选择丹方、材料变化或分析过期，都会导致无法炼制；返回准备阶段修改即可。',
  },
] as const;

export function AlchemyGuideView({
  focus = 'reference',
  onBack,
  onOpenFurnace,
}: {
  focus?: 'basics' | 'reference';
  onBack(): void;
  onOpenFurnace(): void;
}) {
  return (
    <AlchemyToolWorkspace
      title={focus === 'basics' ? '第一炉建议' : '炼丹说明'}
      backLabel="炉理碑"
      onBack={onBack}
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title} className="border-ink/15 border p-5">
              <h3 className="text-base font-medium">{section.title}</h3>
              <p className="text-ink-secondary mt-2 text-sm leading-7">
                {section.body}
              </p>
            </section>
          ))}
        </div>
        <div className="flex justify-end">
          <InkButton variant="primary" onClick={onOpenFurnace}>
            前往丹炉
          </InkButton>
        </div>
      </div>
    </AlchemyToolWorkspace>
  );
}

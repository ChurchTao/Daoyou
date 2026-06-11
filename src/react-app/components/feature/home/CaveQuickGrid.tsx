import { InkButton } from '@app/components/ui/InkButton';

type CaveQuickArea = {
  label: string;
  href: string;
};

type CaveQuickGroup = {
  title: string;
  areas: CaveQuickArea[];
};

const CAVE_AREA_GROUPS: CaveQuickGroup[] = [
  {
    title: '洞府内',
    areas: [
      { label: '🧘 修炼室', href: '/game/retreat' },
      { label: '🌕 炼丹房', href: '/game/craft/alchemy' },
      { label: '🔥 炼器室', href: '/game/craft/refine' },
      { label: '📚 悟道室', href: '/game/enlightenment' },
      { label: '👊 练功房', href: '/game/training-room' },
      { label: '💧 灵眼之泉', href: '/game/inn' },
    ],
  },
  {
    title: '出洞府',
    areas: [
      { label: '⛰️ 外出云游', href: '/game/dungeon' },
      { label: '🛖 坊市', href: '/game/map?intent=market' },
      { label: '🪞 蜃楼幻境', href: '/game/tower' },
      { label: '🔨 拍卖行', href: '/game/auction' },
    ],
  },
];

export function CaveQuickGrid() {
  return (
    <div className="space-y-3">
      {CAVE_AREA_GROUPS.map((group) => (
        <section key={group.title} className="space-y-1.5">
          <div className="text-battle-muted text-[0.68rem] tracking-[0.18em]">
            {group.title}
          </div>
          <div className="flex flex-wrap gap-x-1 gap-y-0.5">
            {group.areas.map((area) => (
              <InkButton key={area.href} href={area.href}>
                {area.label}
              </InkButton>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

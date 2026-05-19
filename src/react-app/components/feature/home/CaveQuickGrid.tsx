import Link from '@app/components/router/AppLink';

type CaveQuickArea = {
  title: string;
  href: string;
};

const CAVE_AREAS: CaveQuickArea[] = [
  { title: '🧘 修炼室', href: '/game/retreat' },
  { title: '🌕 炼丹房', href: '/game/craft/alchemy' },
  { title: '🔥 炼器室', href: '/game/craft/refine' },
  { title: '📚 藏经阁', href: '/game/enlightenment' },
  { title: '⛰️ 外出云游', href: '/game/dungeon' },
  { title: '🔔 传音玉简', href: '/game/mail' },
  { title: '👊 练功房', href: '/game/training-room' },
  { title: '🪞 储物袋', href: '/game/inventory' },
];

export function CaveQuickGrid() {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {CAVE_AREAS.map((area) => (
        <Link
          key={area.href}
          href={area.href}
          className="border-ink/10 bg-ink/4 text-ink hover:border-crimson/35 hover:bg-ink/7 flex min-h-16 items-center justify-center border text-[0.95rem] font-semibold tracking-[0.08em] transition"
        >
          {area.title}
        </Link>
      ))}
    </div>
  );
}

/** Shared gathering light and furnace fire for crafting scenes. */
export function FurnaceGatherEffect({ slots }: { slots: boolean[] }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 motion-reduce:hidden"
    >
      {[
        [50, 10],
        [84, 29],
        [84, 70],
        [50, 90],
        [16, 70],
        [16, 29],
      ].map(([x, y], index) =>
        slots[index] ? (
          <div
            key={index}
            className="absolute inset-0 motion-safe:animate-[forge-gather_800ms_ease-in_both]"
            style={{ transformOrigin: '50% 53%' }}
          >
            <span
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_18px_7px_rgba(217,146,62,0.65)]"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          </div>
        ) : null,
      )}
      <div className="absolute top-[53%] left-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(255,210,120,0.85),rgba(210,95,30,0.4)_40%,transparent_70%)] motion-safe:animate-[forge-fire_1600ms_ease-in-out_infinite_alternate]" />
    </div>
  );
}

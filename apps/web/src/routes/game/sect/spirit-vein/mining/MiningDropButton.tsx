export function MiningDropButton({
  disabled,
  onDrop,
}: {
  disabled?: boolean;
  onDrop: () => void;
}) {
  return (
    <button
      type="button"
      className="pointer-events-auto absolute top-[max(calc(env(safe-area-inset-top)+4.25rem),4.75rem)] right-[max(env(safe-area-inset-right),0.75rem)] z-20 grid h-16 w-16 touch-none select-none place-items-center rounded-full bg-[#173a30]/78 text-sm font-semibold tracking-[0.12em] text-emerald-50 shadow-xl ring-1 ring-emerald-100/25 backdrop-blur-md transition active:scale-90 active:bg-[#235143]/90 disabled:pointer-events-none disabled:opacity-40"
      aria-label="放下灵索"
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        if (!disabled) onDrop();
      }}
    >
      放索
    </button>
  );
}

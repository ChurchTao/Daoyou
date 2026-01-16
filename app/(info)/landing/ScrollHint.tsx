'use client';

export function ScrollHint() {
  return (
    <div
      className="absolute bottom-8 left-1/2 transform -translate-x-1/2 scroll-hint cursor-pointer"
      onClick={() =>
        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
      }
    >
      <p className="text-ink-muted text-xs md:text-sm mb-2 opacity-60">
        向下探索
      </p>
      <svg
        className="w-6 h-6 text-ink-secondary mx-auto opacity-60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    </div>
  );
}

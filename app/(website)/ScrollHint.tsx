'use client';

export function ScrollHint() {
  return (
    <div
      className="scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 transform cursor-pointer"
      onClick={() =>
        document
          .getElementById('features')
          ?.scrollIntoView({ behavior: 'smooth' })
      }
    >
      <p className="text-ink-muted mb-2 text-xs opacity-60 md:text-sm">
        向下探索
      </p>
      <svg
        className="text-ink-secondary mx-auto h-6 w-6 opacity-60"
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

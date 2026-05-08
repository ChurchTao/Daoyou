'use client';

interface FateEffectInlineListProps {
  lines: string[];
}

export function FateEffectInlineList({ lines }: FateEffectInlineListProps) {
  if (lines.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm">
      {lines.map((line, index) => (
        <li key={`${line}-${index}`} className="text-ink-secondary leading-relaxed">
          · {line}
        </li>
      ))}
    </ul>
  );
}

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@app/components/layout', () => ({
  InkModal: ({ title, children, footer }: any) => (
    <div>
      <h2>{title}</h2>
      <div>{children}</div>
      <footer>{footer}</footer>
    </div>
  ),
}));

vi.mock('@app/components/ui', () => ({
  InkButton: ({ children, disabled, className }: any) => (
    <button data-disabled={disabled} className={className}>
      {children}
    </button>
  ),
  InkIdentifyCelebration: ({ variant }: any) => (
    <div data-testid={`celebration:${variant}`} />
  ),
}));

import { RetreatResultModal } from './RetreatResultModal';

describe('RetreatResultModal', () => {
  it('locks the footer while the story is still streaming', () => {
    const html = renderToStaticMarkup(
      <RetreatResultModal
        isOpen
        retreatResult={{
          action: 'breakthrough',
          storyType: 'breakthrough',
          summary: {
            success: true,
            chance: 0.84,
            modifiers: {
              pillBonus: 0.04,
              fateBonus: 0.03,
            },
            attributeGrowth: {},
            lifespanGained: 20,
          } as any,
        }}
        isStreaming
        celebrationTick={1}
        onClose={vi.fn()}
        onGoReincarnate={vi.fn()}
      />,
    );

    expect(html).toContain('天机推演中……');
    expect(html).toContain('推演中……');
    expect(html).toContain('celebration:basic');
  });

  it('keeps only the reincarnate entry once lifespan is depleted', () => {
    const html = renderToStaticMarkup(
      <RetreatResultModal
        isOpen
        retreatResult={{
          action: 'cultivate',
          storyType: 'lifespan',
          depleted: true,
          story: '炉火将熄，道心未灭。',
          summary: {
            exp_gained: 12,
            progress: 68,
            insight_gained: 0,
            epiphany_triggered: false,
            bottleneck_entered: false,
          } as any,
        }}
        isStreaming={false}
        celebrationTick={0}
        onClose={vi.fn()}
        onGoReincarnate={vi.fn()}
      />,
    );

    expect(html).toContain('炉火将熄，道心未灭。');
    expect(html).not.toContain('稍后再看');
    expect(html).toContain('转世重修');
  });
});

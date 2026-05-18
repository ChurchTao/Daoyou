import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { GameBottomDock } from './GameBottomDock';

describe('GameBottomDock', () => {
  it('renders the role entry as a normal link to the cultivator scene', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GameBottomDock
          sceneId="cave"
          unreadMailCount={2}
          isExpanded={false}
          onToggleExpanded={() => {}}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/game/cultivator"');
    expect(html).toContain('[角色]');
  });
});

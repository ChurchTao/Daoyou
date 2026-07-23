import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('sect sweep iframe lifecycle boundary', () => {
  it('isolates each session and validates the message envelope', () => {
    const overlay = readFileSync(
      'src/react-app/components/feature/sect/SweepGameOverlay.tsx',
      'utf8',
    );
    const runtime = readFileSync(
      'src/react-app/routes/sect-sweep-runtime/route.tsx',
      'utf8',
    );
    expect(overlay).toContain('sandbox="allow-scripts allow-same-origin"');
    expect(overlay).toContain('event.source !== iframeRef.current?.contentWindow');
    expect(overlay).toContain('event.data?.rulesVersion !== session.rulesVersion');
    expect(runtime).toContain('event.source !== window.parent');
    expect(runtime).toContain('event.data?.rulesVersion !== rulesVersion');
    expect(runtime).toContain("window.removeEventListener('message', onMessage)");
    expect(runtime).toContain('controller?.destroy()');
    expect(runtime).toContain("post('sect-sweep:error', message)");
    expect(runtime).toContain("event.data.type === 'sect-sweep:reset'");
  });
});

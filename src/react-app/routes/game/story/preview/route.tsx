import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { InkButton } from '@app/components/ui';
import { fillPerformanceScript } from '@shared/performance/schema';
import { getPerformanceScript } from '@shared/performance/catalog';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

export default function StoryPreviewRoute() {
  const navigate = useNavigate();
  const scriptId = useParams().scriptId ?? '';
  const [outcome, setOutcome] = useState<string>();
  const script = (() => {
    try {
      return getPerformanceScript(scriptId);
    } catch {
      return null;
    }
  })();

  if (!script) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-6 text-[#f3ecdc]">
        <div className="text-center">
          <p>没有这场演出。</p>
          <InkButton onClick={() => navigate('/game')} className="mt-5">
            回洞府
          </InkButton>
        </div>
      </div>
    );
  }

  const filled = fillPerformanceScript(script, {
    name: '道友',
    background: script.requires.includes('background') ? '预览用的来处' : '',
  });

  return (
    <>
      <PerformancePlayer
        key={filled.id}
        script={filled}
        context={{ name: '道友', background: '预览用的来处' }}
        finalLabel="记下结果"
        onExit={() => navigate('/game')}
        onFinish={setOutcome}
      />
      {outcome ? (
        <p className="pointer-events-none fixed bottom-6 left-6 text-sm text-[#f0c77b]">
          结果：{outcome}
        </p>
      ) : null}
    </>
  );
}

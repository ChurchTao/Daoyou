import {
  readActivityViewportState,
  type ActivityViewportState,
} from '@app/lib/gameActivityImmersive';
import { useEffect, useState } from 'react';

export function useGameActivityViewport(): ActivityViewportState {
  const [viewport, setViewport] = useState(readActivityViewportState);

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    const landscape = window.matchMedia('(orientation: landscape)');
    const standalone = window.matchMedia('(display-mode: standalone)');
    const fullscreenDisplay = window.matchMedia('(display-mode: fullscreen)');
    const update = () => setViewport(readActivityViewportState());

    coarsePointer.addEventListener('change', update);
    landscape.addEventListener('change', update);
    standalone.addEventListener('change', update);
    fullscreenDisplay.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', update);

    return () => {
      coarsePointer.removeEventListener('change', update);
      landscape.removeEventListener('change', update);
      standalone.removeEventListener('change', update);
      fullscreenDisplay.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('fullscreenchange', update);
    };
  }, []);

  return viewport;
}

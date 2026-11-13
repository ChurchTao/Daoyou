import { GuideOverlay } from '@app/components/feature/guide/GuideOverlay';
import { SceneGate } from '@app/components/feature/story/SceneGate';
import { PaperSurface } from '@app/components/ui/PaperSurface';
import { Outlet } from 'react-router';

/** No v5 scene provider, battle layout, player or playback dependencies. */
export function CombatV6Layout() {
  return (
    <PaperSurface as="main" className="h-dvh overflow-hidden">
      <SceneGate>
        <Outlet />
      </SceneGate>
      {/* 战斗里的教学和别处用同一套遮罩指引；地址里没有教学时什么也不画。 */}
      <GuideOverlay />
    </PaperSurface>
  );
}

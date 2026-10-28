import { PaperSurface } from '@app/components/ui/PaperSurface';
import { Outlet } from 'react-router';

/** No v5 scene provider, battle layout, player or playback dependencies. */
export function CombatV6Layout() {
  return (
    <PaperSurface as="main" className="h-dvh overflow-hidden">
      <Outlet />
    </PaperSurface>
  );
}

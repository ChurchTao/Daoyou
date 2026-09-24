import { Outlet } from 'react-router';

/** No v5 scene provider, battle layout, player or playback dependencies. */
export function CombatV6Layout() {
  return (
    <main className="bg-paper h-dvh overflow-hidden">
      <Outlet />
    </main>
  );
}

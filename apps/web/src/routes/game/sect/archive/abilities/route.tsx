import { Navigate } from 'react-router';

export default function SectArchiveAbilitiesRedirect() {
  return <Navigate to="/game/cultivator?tab=sect" replace />;
}

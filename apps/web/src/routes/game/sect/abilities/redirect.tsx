import { Navigate } from 'react-router';

export default function SectAbilitiesRedirect() {
  return <Navigate to="/game/cultivator?tab=sect" replace />;
}

import { useAlchemyCraftSession } from '../alchemyCraftContext';
export function FurnaceFiringStage() {
  const session = useAlchemyCraftSession();
  return (
    <p role="status" className="text-ink-secondary my-4 text-center text-xs">
      {session.status || '炉火正盛，静候丹成……'}
    </p>
  );
}

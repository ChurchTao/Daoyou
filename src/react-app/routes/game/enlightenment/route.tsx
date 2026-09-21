import { EnlightenmentRoom } from '@app/components/feature/enlightenment/EnlightenmentRoom';
import { useCultivatorIdentity } from '@app/lib/resources/player';

export default function Page() {
  const identity = useCultivatorIdentity();
  const ownerId = identity.data?.cultivator.id;
  return ownerId ? (
    <EnlightenmentRoom key={ownerId} ownerId={ownerId} />
  ) : (
    <p role="status">{identity.error ?? '正在走入悟道室……'}</p>
  );
}

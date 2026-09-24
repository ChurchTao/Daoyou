import { InscriptionRoom } from '@app/components/feature/inscriptions/InscriptionRoom';
import { useCultivatorIdentity } from '@app/lib/resources/player';

export default function Page() {
  const identity = useCultivatorIdentity();
  const ownerId = identity.data?.cultivator.id;
  return ownerId ? (
    <InscriptionRoom key={ownerId} ownerId={ownerId} />
  ) : (
    <p role="status">{identity.error ?? '正在走入阵纹室……'}</p>
  );
}

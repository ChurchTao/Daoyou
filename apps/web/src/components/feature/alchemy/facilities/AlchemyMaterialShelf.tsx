import type { Material } from '@daoyou/game-domain/character';
import { AlchemyBag } from '../AlchemyBag';
export function AlchemyMaterialShelf({
  onCarry,
}: {
  onCarry(material: Material, dose: number): void;
}) {
  return <AlchemyBag onChoose={onCarry} />;
}

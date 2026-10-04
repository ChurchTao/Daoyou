import { createInventoryEquipmentSchema } from '@daoyou/game-domain/equipment';
import { validateFormationInscriptions } from '../equipment/inscriptions.js';

export const InventoryEquipmentSchema = createInventoryEquipmentSchema(validateFormationInscriptions);

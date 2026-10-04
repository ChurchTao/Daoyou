export type InscriptionRef = { id: string; revision: number };

export type InscriptionMaterialRef = InscriptionRef & { quantity: number };

export type InscriptionCost = { qi: number; spiritStones: number };

export type InscriptionDrawPreview = {
  totalTenths: number;
  remainderTenths: number;
  outputs: { level: number; quantity: number }[];
  cost: InscriptionCost;
};

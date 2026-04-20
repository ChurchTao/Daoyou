import { CreationIntent, CreationProductType } from '../../types';
import { MaterialFacts } from './MaterialFacts';

export interface RecipeFacts {
  productType: CreationProductType;
  material: MaterialFacts;
  intent: CreationIntent;
}
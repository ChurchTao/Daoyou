import type { SectContextData } from '@daoyou/shared/contracts/sect';
import {
  SECT_RANK_LABELS,
  type SectOffice,
} from '@daoyou/shared/engine/sect';
import { getSectDefinition } from './sectResources';

const SECT_OFFICE_LABELS: Record<SectOffice, string> = {
  none: '暂无职司',
  steward: '宗门执事',
  protector: '宗门护法',
  elder: '宗门长老',
};

export function getSectIdentityLabels(context: SectContextData) {
  return {
    sectName: getSectDefinition(context).name,
    rankLabel: SECT_RANK_LABELS[context.discipleRank],
    officeLabel: SECT_OFFICE_LABELS[context.office ?? 'none'],
  };
}

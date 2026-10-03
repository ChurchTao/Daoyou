import { Injectable } from '@nestjs/common';
import { readCombatActivityNotice } from '@server/combat/application/CombatActivityNotice.js';

@Injectable()
export class CombatActivityService {
  async read(cultivatorId: string) {
    return {
      success: true,
      data: await readCombatActivityNotice(cultivatorId),
    };
  }
}

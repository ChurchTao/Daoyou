import {
  SECT_DISCIPLE_RANKS,
  SECT_RANK_ORDER,
  type SectDiscipleRank,
} from '../domain/organization';
import type {
  SectDonationDemandDefinition,
  SectRewardGrantDefinition,
} from './contracts';

export type SectDomainEvent =
  | {
      type: 'SectTaskCompleted';
      taskId: string;
      taskRecordId: string;
      membershipId: string;
      kind: 'daily' | 'weekly' | 'promotion';
    }
  | { type: 'SectTaskProgressSignaled'; membershipId: string; source: string; amount: number }
  | { type: 'SectContributionGranted'; membershipId: string; amount: number; reason: string; referenceId: string }
  | { type: 'SectContributionSpent'; membershipId: string; amount: number; reason: string; referenceId: string }
  | { type: 'SectSpiritStonesGranted'; cultivatorId: string; amount: number }
  | { type: 'SectCultivationExpGranted'; userId: string; cultivatorId: string; amount: number }
  | { type: 'SectMembershipPromoted'; membershipId: string; rank: SectDiscipleRank }
  | {
      type: 'SectDonationAccepted';
      donationId: string;
      membershipId: string;
      projectId: string;
      dateKey: string;
      demand: SectDonationDemandDefinition;
      itemSnapshot: Record<string, unknown>;
      contribution: number;
      constructionPoints: number;
      projectProgress: number;
    }
  | { type: 'SectProjectCompleted'; projectId: string; facilityKey: string; targetLevel: number }
  | { type: 'SectFacilityUpgraded'; sectId: string; facilityKey: string; level: number }
  | {
      type: 'SectStipendClaimed';
      membershipId: string;
      weekKey: string;
      rewardSnapshot: {
        spiritStones: number;
        rewards: readonly SectRewardGrantDefinition[];
      };
    };

export class SectDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SectDomainError';
  }
}

export class ContributionBalance {
  private constructor(private value: number) {}

  static of(value: number): ContributionBalance {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new SectDomainError('宗门贡献必须是非负整数');
    return new ContributionBalance(value);
  }

  amount(): number {
    return this.value;
  }

  credit(amount: number): void {
    this.assertPositive(amount);
    this.value += amount;
  }

  spend(amount: number): void {
    this.assertPositive(amount);
    if (this.value < amount) throw new SectDomainError('宗门贡献不足');
    this.value -= amount;
  }

  private assertPositive(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new SectDomainError('贡献变动必须是正整数');
  }
}

export class DiscipleRank {
  private constructor(readonly value: SectDiscipleRank) {}

  static of(value: SectDiscipleRank): DiscipleRank {
    if (!SECT_DISCIPLE_RANKS.includes(value))
      throw new SectDomainError('未知弟子职阶');
    return new DiscipleRank(value);
  }

  isAtLeast(required: SectDiscipleRank): boolean {
    return SECT_RANK_ORDER[this.value] >= SECT_RANK_ORDER[required];
  }

  promoteTo(target: SectDiscipleRank): DiscipleRank {
    if (SECT_RANK_ORDER[target] !== SECT_RANK_ORDER[this.value] + 1)
      throw new SectDomainError('只能晋升至下一弟子职阶');
    return DiscipleRank.of(target);
  }
}

export class TaskPeriod {
  private constructor(readonly value: string) {}

  static of(value: string): TaskPeriod {
    if (!value.trim()) throw new SectDomainError('任务周期不能为空');
    return new TaskPeriod(value);
  }

  equals(other: string): boolean {
    return this.value === other;
  }
}

export class FacilityLevel {
  private constructor(readonly value: number) {}

  static of(value: number): FacilityLevel {
    if (!Number.isSafeInteger(value) || value < 0 || value > 5)
      throw new SectDomainError('设施等级必须是 0 至 5 的整数');
    return new FacilityLevel(value);
  }
}

export interface PromotionViolation {
  code: string;
  message: string;
}

export interface PromotionEvaluation {
  allowed: boolean;
  violations: readonly PromotionViolation[];
}

export class SectMembership {
  private events: SectDomainEvent[] = [];
  private rank: DiscipleRank;
  private contribution: ContributionBalance;

  private constructor(
    readonly id: string,
    readonly sectId: string,
    rank: SectDiscipleRank,
    contribution: number,
  ) {
    this.rank = DiscipleRank.of(rank);
    this.contribution = ContributionBalance.of(contribution);
  }

  static rehydrate(input: {
    id: string;
    sectId: string;
    rank: SectDiscipleRank;
    contribution: number;
  }): SectMembership {
    return new SectMembership(input.id, input.sectId, input.rank, input.contribution);
  }

  discipleRank(): SectDiscipleRank {
    return this.rank.value;
  }

  contributionBalance(): number {
    return this.contribution.amount();
  }

  creditContribution(amount: number, reason: string, referenceId: string): void {
    this.contribution.credit(amount);
    this.events.push({
      type: 'SectContributionGranted',
      membershipId: this.id,
      amount,
      reason,
      referenceId,
    });
  }

  spendContribution(amount: number, reason: string, referenceId: string): void {
    this.contribution.spend(amount);
    this.events.push({
      type: 'SectContributionSpent',
      membershipId: this.id,
      amount,
      reason,
      referenceId,
    });
  }

  evaluatePromotion(violations: readonly PromotionViolation[]): PromotionEvaluation {
    return { allowed: violations.length === 0, violations };
  }

  promote(target: SectDiscipleRank, evaluation: PromotionEvaluation): void {
    if (!evaluation.allowed)
      throw new SectDomainError(evaluation.violations.map((item) => item.message).join('、'));
    this.rank = this.rank.promoteTo(target);
    this.events.push({ type: 'SectMembershipPromoted', membershipId: this.id, rank: target });
  }

  pullEvents(): SectDomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export type SectTaskState = 'offered' | 'active' | 'completed';

export class SectTask {
  private events: SectDomainEvent[] = [];
  private state: SectTaskState;
  private progressValue: number;

  private constructor(
    readonly id: string,
    readonly definitionId: string,
    readonly membershipId: string,
    readonly kind: 'daily' | 'weekly' | 'promotion',
    readonly periodKey: string,
    readonly target: number,
    state: SectTaskState,
    progress: number,
  ) {
    if (!Number.isSafeInteger(target) || target <= 0)
      throw new SectDomainError('任务目标必须是正整数');
    if (!Number.isSafeInteger(progress) || progress < 0 || progress > target)
      throw new SectDomainError('任务进度无效');
    TaskPeriod.of(periodKey);
    this.state = state;
    this.progressValue = progress;
  }

  static offered(input: {
    id: string;
    definitionId: string;
    membershipId: string;
    kind: 'daily' | 'weekly' | 'promotion';
    periodKey: string;
    target: number;
  }): SectTask {
    return new SectTask(
      input.id,
      input.definitionId,
      input.membershipId,
      input.kind,
      input.periodKey,
      input.target,
      'offered',
      0,
    );
  }

  static rehydrate(input: {
    id: string;
    definitionId: string;
    membershipId: string;
    kind: 'daily' | 'weekly' | 'promotion';
    periodKey: string;
    target: number;
    state: Exclude<SectTaskState, 'offered'>;
    progress: number;
  }): SectTask {
    return new SectTask(
      input.id,
      input.definitionId,
      input.membershipId,
      input.kind,
      input.periodKey,
      input.target,
      input.state,
      input.progress,
    );
  }

  status(): SectTaskState {
    return this.state;
  }

  progress(): number {
    return this.progressValue;
  }

  accept(periodKey: string): void {
    if (!TaskPeriod.of(this.periodKey).equals(periodKey))
      throw new SectDomainError('任务周期不匹配');
    if (this.state !== 'offered') throw new SectDomainError('任务已经领取');
    this.state = 'active';
  }

  advance(amount = 1): boolean {
    if (this.state !== 'active') throw new SectDomainError('任务不在进行中');
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new SectDomainError('任务进度增量无效');
    this.progressValue = Math.min(this.target, this.progressValue + amount);
    return this.progressValue >= this.target;
  }

  complete(): boolean {
    if (this.state === 'completed') return false;
    if (this.state !== 'active') throw new SectDomainError('任务尚未领取');
    this.progressValue = this.target;
    this.state = 'completed';
    this.events.push({
      type: 'SectTaskCompleted',
      taskId: this.definitionId,
      taskRecordId: this.id,
      membershipId: this.membershipId,
      kind: this.kind,
    });
    return true;
  }

  pullEvents(): SectDomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export class SectConstructionProject {
  private events: SectDomainEvent[] = [];
  private progressValue: number;
  private completed: boolean;

  private constructor(
    readonly id: string,
    readonly sectId: string,
    readonly facilityKey: string,
    readonly targetLevel: number,
    readonly target: number,
    progress: number,
    completed: boolean,
  ) {
    if (!Number.isSafeInteger(target) || target <= 0)
      throw new SectDomainError('工程目标必须是正整数');
    if (!Number.isSafeInteger(progress) || progress < 0 || progress > target)
      throw new SectDomainError('工程进度无效');
    FacilityLevel.of(targetLevel);
    this.progressValue = progress;
    this.completed = completed;
  }

  static rehydrate(input: {
    id: string;
    sectId: string;
    facilityKey: string;
    targetLevel: number;
    target: number;
    progress: number;
    completed: boolean;
  }): SectConstructionProject {
    return new SectConstructionProject(
      input.id,
      input.sectId,
      input.facilityKey,
      input.targetLevel,
      input.target,
      input.progress,
      input.completed,
    );
  }

  progress(): number {
    return this.progressValue;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  applyDonation(
    membershipId: string,
    contribution: number,
    points: number,
    settlement: {
      donationId: string;
      dateKey: string;
      demand: SectDonationDemandDefinition;
      itemSnapshot: Record<string, unknown>;
    },
  ): void {
    if (this.completed) throw new SectDomainError('工程已经完成');
    if (!Number.isSafeInteger(points) || points <= 0)
      throw new SectDomainError('建设点数必须是正整数');
    if (!Number.isSafeInteger(contribution) || contribution <= 0)
      throw new SectDomainError('捐献贡献必须是正整数');
    this.progressValue = Math.min(this.target, this.progressValue + points);
    this.events.push({
      type: 'SectDonationAccepted',
      donationId: settlement.donationId,
      membershipId,
      projectId: this.id,
      dateKey: settlement.dateKey,
      demand: settlement.demand,
      itemSnapshot: settlement.itemSnapshot,
      contribution,
      constructionPoints: points,
      projectProgress: this.progressValue,
    });
    if (this.progressValue >= this.target) {
      this.completed = true;
      this.events.push({
        type: 'SectProjectCompleted',
        projectId: this.id,
        facilityKey: this.facilityKey,
        targetLevel: this.targetLevel,
      });
      this.events.push({
        type: 'SectFacilityUpgraded',
        sectId: this.sectId,
        facilityKey: this.facilityKey,
        level: this.targetLevel,
      });
    }
  }

  pullEvents(): SectDomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export class SectStipendClaim {
  private events: SectDomainEvent[] = [];

  private constructor(
    readonly membershipId: string,
    readonly weekKey: string,
    private claimed: boolean,
  ) {}

  static rehydrate(input: {
    membershipId: string;
    weekKey: string;
    claimed: boolean;
  }): SectStipendClaim {
    return new SectStipendClaim(input.membershipId, input.weekKey, input.claimed);
  }

  claim(
    periodKey: string,
    rewardSnapshot: {
      spiritStones: number;
      rewards: readonly SectRewardGrantDefinition[];
    },
  ): void {
    if (periodKey !== this.weekKey) throw new SectDomainError('俸禄周期不匹配');
    if (this.claimed) throw new SectDomainError('本周俸禄已经领取');
    this.claimed = true;
    this.events.push({
      type: 'SectStipendClaimed',
      membershipId: this.membershipId,
      weekKey: this.weekKey,
      rewardSnapshot,
    });
  }

  pullEvents(): SectDomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export class SectShopOrder {
  private constructor(
    readonly itemId: string,
    readonly quantity: number,
    readonly totalCost: number,
  ) {}

  static quote(input: {
    itemId: string;
    quantity: number;
    purchased: number;
    stock: number;
    unitPrice: number;
  }): SectShopOrder {
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0)
      throw new SectDomainError('兑换数量必须是正整数');
    if (
      !Number.isSafeInteger(input.purchased) ||
      !Number.isSafeInteger(input.stock) ||
      input.purchased < 0 ||
      input.stock < 0
    )
      throw new SectDomainError('宝库库存状态无效');
    if (input.purchased + input.quantity > input.stock)
      throw new SectDomainError('本周个人库存不足');
    if (!Number.isSafeInteger(input.unitPrice) || input.unitPrice <= 0)
      throw new SectDomainError('兑换价格无效');
    return new SectShopOrder(
      input.itemId,
      input.quantity,
      input.unitPrice * input.quantity,
    );
  }
}

export class SectDonationOffer {
  private constructor(
    readonly demandId: string,
    readonly units: number,
    readonly itemQuantity: number,
    readonly contribution: number,
    readonly constructionPoints: number,
  ) {}

  static quote(input: {
    demandId: string;
    units: number;
    quantityPerUnit: number;
    contributionPerUnit: number;
    constructionPointsPerUnit: number;
  }): SectDonationOffer {
    for (const value of [
      input.units,
      input.quantityPerUnit,
      input.contributionPerUnit,
      input.constructionPointsPerUnit,
    ])
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new SectDomainError('宗门需求数量与奖励必须是正整数');
    return new SectDonationOffer(
      input.demandId,
      input.units,
      input.quantityPerUnit * input.units,
      input.contributionPerUnit * input.units,
      input.constructionPointsPerUnit * input.units,
    );
  }
}

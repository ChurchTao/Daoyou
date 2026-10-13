export const RED_PACKET_MIN_AMOUNT = 50_000;
export const RED_PACKET_MAX_AMOUNT = 10_000_000;
export const RED_PACKET_MIN_COUNT = 1;
export const RED_PACKET_MAX_COUNT = 100;

export type RedPacketMode = 'equal' | 'random';

export interface RedPacketInput {
  amount: number;
  count: number;
  mode: RedPacketMode;
}

export function validateRedPacketInput(input: RedPacketInput): string | null {
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount < RED_PACKET_MIN_AMOUNT ||
    input.amount > RED_PACKET_MAX_AMOUNT
  ) {
    return '红包总额须为 50,000 至 10,000,000 的整数灵石';
  }
  if (
    !Number.isSafeInteger(input.count) ||
    input.count < RED_PACKET_MIN_COUNT ||
    input.count > RED_PACKET_MAX_COUNT
  ) {
    return '红包份数须为 1 至 100 的整数';
  }
  if (input.mode !== 'equal' && input.mode !== 'random') {
    return '请选择等额红包或拼手气红包';
  }
  if (input.mode === 'equal' && input.amount % input.count !== 0) {
    return '等额红包的总额须能被份数整除';
  }
  return null;
}

/** The host supplies an integer draw with inclusive minimum and maximum bounds. */
export function allocateRedPacketAmounts(
  input: RedPacketInput,
  randomInteger: (min: number, max: number) => number,
): number[] {
  const error = validateRedPacketInput(input);
  if (error) throw new RangeError(error);
  if (input.mode === 'equal') {
    return Array<number>(input.count).fill(input.amount / input.count);
  }

  const amounts: number[] = [];
  let remainingAmount = input.amount;
  for (
    let remainingCount = input.count;
    remainingCount > 1;
    remainingCount -= 1
  ) {
    // Bound draws around the remaining average and reserve at least one per recipient.
    const min = Math.max(1, Math.floor(remainingAmount / (remainingCount * 2)));
    const max = Math.min(
      remainingAmount - (remainingCount - 1),
      Math.floor((remainingAmount * 3) / (remainingCount * 2)),
    );
    const amount = randomInteger(min, max);
    if (!Number.isSafeInteger(amount) || amount < min || amount > max) {
      throw new RangeError('红包随机金额超出分配范围');
    }
    amounts.push(amount);
    remainingAmount -= amount;
  }
  amounts.push(remainingAmount);
  return amounts;
}

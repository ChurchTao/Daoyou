/** Public social/red-packets capabilities. Keep implementation files private. */
export {
  RED_PACKET_MAX_AMOUNT,
  RED_PACKET_MAX_COUNT,
  RED_PACKET_MIN_AMOUNT,
  RED_PACKET_MIN_COUNT,
  allocateRedPacketAmounts,
  validateRedPacketInput,
} from '../../social/red-packets.js';
export type {
  RedPacketInput,
  RedPacketMode,
} from '../../social/red-packets.js';

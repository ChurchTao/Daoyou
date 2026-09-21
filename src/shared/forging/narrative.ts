import { z } from 'zod';

export const FORGE_INTENT_MAX_LENGTH = 100;
export const ForgeIntentSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => Array.from(value).length <= FORGE_INTENT_MAX_LENGTH,
    '铸器心念不能超过100字',
  );
export const ForgedEquipmentNameSchema = z
  .string()
  .regex(/^[\p{Script=Han}]{2,8}$/u, '器名须为2至8个汉字')
  .refine((value) => value.trim() === value, '器名不能含首尾空白');
export const ForgedEquipmentDescSchema = z
  .string()
  .regex(
    /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]{1,60}$/u,
    '器物描述须为60字以内的单行纯文本',
  )
  .refine(
    (value) => value.trim() === value && value.length > 0,
    '描述不能留空或含首尾空白',
  );
export const EquipmentCrafterNameSchema = z.string().min(1).max(100);
export const ForgedEquipmentCopySchema = z
  .object({
    name: ForgedEquipmentNameSchema,
    desc: ForgedEquipmentDescSchema,
  })
  .strict();

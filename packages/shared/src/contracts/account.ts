import type { ApiSuccess } from '@daoyou/shared/contracts/http';
import { z } from 'zod';

export const AccountSetPasswordRequestSchema = z.object({
  newPassword: z.string().min(1, '请输入新密码'),
});

export type AccountSetPasswordRequest = z.infer<
  typeof AccountSetPasswordRequestSchema
>;

export type AccountSetPasswordResponse = ApiSuccess<{
  status: boolean;
}>;

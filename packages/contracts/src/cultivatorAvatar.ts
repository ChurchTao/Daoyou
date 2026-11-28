import { z } from 'zod';

export const AvatarSizeSchema = z.enum(['96', '384', '1024']);
export type AvatarSize = z.infer<typeof AvatarSizeSchema>;
export const AVATAR_SIZES = AvatarSizeSchema.options;

export type CultivatorPortraitRef = {
  avatarId?: string | null;
  gender?: string | null;
};

export const AVATAR_DESCRIPTION_LIMIT = 60;
export const CreateAvatarSchema = z.strictObject({
  requestId: z.uuid(),
  itemId: z.uuid(),
  revision: z.int().nonnegative(),
  description: z
    .string()
    .trim()
    .min(2, '请填写人物外观')
    .max(
      AVATAR_DESCRIPTION_LIMIT,
      `人物外观最多 ${AVATAR_DESCRIPTION_LIMIT} 字`,
    ),
});
export type CreateAvatarInput = z.infer<typeof CreateAvatarSchema>;
export const EquipAvatarSchema = z.strictObject({
  avatarId: z.uuid().nullable(),
});

export type AvatarJobStatus =
  'queued' | 'generating' | 'processing' | 'ready' | 'failed';
export type AvatarFailure =
  'description' | 'moderation' | 'generation' | 'storage';
export type AvatarJobView = {
  id: string;
  description: string;
  status: AvatarJobStatus;
  failure: AvatarFailure | null;
  refundLocation: 'bag' | 'storage' | null;
};
export type OwnedAvatar = {
  id: string;
  description: string;
  createdAt: string;
};
export type AvatarCollectionView = {
  generationEnabled: boolean;
  latestJob: AvatarJobView | null;
  avatars: OwnedAvatar[];
  nextCursor: string | null;
};

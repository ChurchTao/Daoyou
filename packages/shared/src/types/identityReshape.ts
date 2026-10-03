import { z } from 'zod';

// Keep this JSON Schema-compatible for providers whose regex engines do not
// support Unicode property escapes such as `\p{Script=Han}`.
const IDENTITY_RESHAPE_NAME_PATTERN =
  /^[\u3400-\u4dbf\u4e00-\u9fff]{2,4}$/u;

export const IdentityReshapeCandidateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(4)
    .regex(IDENTITY_RESHAPE_NAME_PATTERN, '姓名必须为 2-4 个中文字符'),
  origin: z.string().trim().min(2).max(40),
  personality: z.string().trim().min(2).max(100),
  background: z.string().trim().min(10).max(300),
});

export type IdentityReshapeCandidate = z.infer<
  typeof IdentityReshapeCandidateSchema
>;

export type IdentityReshapeNameCheck = 'unique' | 'duplicate' | 'unavailable';

export interface IdentityReshapeQuestionOption {
  id: string;
  label: string;
}

export interface IdentityReshapeQuestion {
  id: string;
  source: string;
  quote: string;
  prompt: string;
  options: IdentityReshapeQuestionOption[];
}

export interface IdentityReshapeAnswer {
  questionId: string;
  optionId: string;
}

export interface IdentityReshapeSessionStore {
  sessionId: string;
  cultivatorId: string;
  questionIds: string[];
  answers: IdentityReshapeAnswer[];
  description: string;
  candidate: IdentityReshapeCandidate | null;
  nameCheck: IdentityReshapeNameCheck | null;
  createdAt: number;
  expiresAt: number;
}

export interface IdentityReshapeSessionDTO {
  sessionId: string;
  questions: IdentityReshapeQuestion[];
  answers: IdentityReshapeAnswer[];
  description: string;
  candidate: IdentityReshapeCandidate | null;
  nameCheck: IdentityReshapeNameCheck | null;
  createdAt: number;
  expiresAt: number;
}

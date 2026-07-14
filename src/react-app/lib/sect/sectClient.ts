import { consumePlayerStateMutation } from '@app/lib/player-state/store';
import type { SectCurrentData, SectExperienceResponse } from '@shared/contracts/sect';

type SectExperienceData = SectExperienceResponse['data'];

let experienceRequest: Promise<SectExperienceData> | null = null;

export async function fetchSectCurrent(): Promise<SectCurrentData> {
  const response = await fetch('/api/sects/current');
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? '宗门卷宗读取失败');
  }
  return payload.data as SectCurrentData;
}

async function startLingxiaoExperience(): Promise<SectExperienceData> {
  const response = await fetch('/api/sects/lingxiao/experience', {
    method: 'POST',
  });
  return consumePlayerStateMutation<SectExperienceData>(response);
}

/**
 * React StrictMode 会重复执行挂载 effect；同一时刻只允许发起一次试剑事务。
 */
export function startLingxiaoExperienceOnce(): Promise<SectExperienceData> {
  if (experienceRequest) {
    return experienceRequest;
  }

  experienceRequest = startLingxiaoExperience().finally(() => {
    experienceRequest = null;
  });
  return experienceRequest;
}

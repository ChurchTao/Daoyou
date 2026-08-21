import type {
  MainStoryMutationResult,
  MainStoryRuntimeEventType,
  MainStoryScene,
  MainStorySceneQueryResult,
  MainStorySnapshot,
  StorySurfaceContext,
  StorySurfaceInteractionResult,
  StorySurfaceKey,
  StorySurfaceResult,
} from '@shared/types/story';

export const STORY_UPDATED_EVENT = 'daoyou:story-updated';
export const STORY_SCENE_EVENT = 'daoyou:story-scene';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: string;
}

type ApiResult<T> = ApiSuccess<T> | ApiFailure;

async function readJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as ApiResult<T>;
  if (!response.ok || !json.success) {
    throw new Error('error' in json ? json.error : `HTTP ${response.status}`);
  }
  return json.data;
}

function dispatchStoryUpdated(story: MainStorySnapshot) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MainStorySnapshot>(STORY_UPDATED_EVENT, { detail: story }),
  );
}

function dispatchStoryScene(scene: MainStoryScene | null) {
  if (!scene || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MainStoryScene>(STORY_SCENE_EVENT, { detail: scene }),
  );
}


export function dispatchStoryMutationResult(data: MainStoryMutationResult) {
  dispatchStoryUpdated(data.story);
  if (data.scene) dispatchStoryScene(data.scene);
  // V1.4: continuation 仍可由卷宗/断点恢复读取，但不再自动广播成全局导航弹窗。
}

export async function fetchMainStorySnapshot(
  signal?: AbortSignal,
): Promise<MainStorySnapshot> {
  const response = await fetch('/api/story', { signal });
  const { story } = await readJson<{ story: MainStorySnapshot }>(response);
  return story;
}

export async function fetchMainStoryScene(
  pathname: string,
  signal?: AbortSignal,
): Promise<MainStorySceneQueryResult> {
  const query = new URLSearchParams({ pathname });
  const response = await fetch(`/api/story/scene?${query.toString()}`, { signal });
  const data = await readJson<MainStorySceneQueryResult>(response);
  dispatchStoryUpdated(data.story);
  return data;
}

export async function resolveMainStoryChoice(args: {
  nodeId: string;
  sceneKey: string;
  choiceId: string;
}): Promise<MainStoryMutationResult> {
  const response = await fetch('/api/story/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...args,
      requestId: crypto.randomUUID(),
    }),
  });
  const data = await readJson<MainStoryMutationResult>(response);
  dispatchStoryMutationResult(data);
  return data;
}

export async function notifyStoryRuntimeEvent(args: {
  eventType: MainStoryRuntimeEventType;
  payload?: Record<string, unknown>;
}): Promise<MainStoryMutationResult> {
  const response = await fetch('/api/story/runtime-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: args.eventType,
      payload: args.payload ?? {},
      requestId: crypto.randomUUID(),
    }),
  });
  const data = await readJson<MainStoryMutationResult>(response);
  dispatchStoryMutationResult(data);
  return data;
}


export async function fetchStorySurface(
  surface: StorySurfaceKey,
  context: StorySurfaceContext = {},
  signal?: AbortSignal,
): Promise<StorySurfaceResult> {
  const query = new URLSearchParams({ surface });
  if (context.mapNodeId) query.set('mapNodeId', context.mapNodeId);
  if (context.npcName) query.set('npcName', context.npcName);
  const response = await fetch(`/api/story/surface?${query.toString()}`, { signal });
  return readJson<StorySurfaceResult>(response);
}

export async function interactStorySurface(args: {
  interactionId: string;
  payload?: Record<string, unknown>;
}): Promise<StorySurfaceInteractionResult> {
  const response = await fetch('/api/story/surface/interact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interactionId: args.interactionId,
      payload: args.payload ?? {},
      requestId: crypto.randomUUID(),
    }),
  });
  const data = await readJson<StorySurfaceInteractionResult>(response);
  dispatchStoryMutationResult(data);
  return data;
}

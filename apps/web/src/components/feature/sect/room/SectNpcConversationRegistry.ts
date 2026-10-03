import type {
  SectRoomActorDefinition,
  SectRoomDefinition,
} from '@daoyou/shared/engine/sect';
import type { ComponentType } from 'react';

export interface SectNpcConversationRendererProps {
  actor: SectRoomActorDefinition;
  parameters: Readonly<Record<string, unknown>>;
  onExit(): void;
}

export type SectNpcConversationRenderer =
  ComponentType<SectNpcConversationRendererProps>;

export interface SectNpcConversationContribution {
  key: string;
  renderer: SectNpcConversationRenderer;
}

export class SectNpcConversationRegistry {
  private readonly renderers = new Map<string, SectNpcConversationRenderer>();

  constructor(contributions: readonly SectNpcConversationContribution[] = []) {
    for (const contribution of contributions) this.register(contribution);
  }

  register(contribution: SectNpcConversationContribution): void {
    if (!contribution.key.trim())
      throw new Error('宗门 NPC 会话展示器标识不能为空');
    if (this.renderers.has(contribution.key))
      throw new Error(`宗门 NPC 会话展示器重复注册：${contribution.key}`);
    this.renderers.set(contribution.key, contribution.renderer);
  }

  get(key: string): SectNpcConversationRenderer | undefined {
    return this.renderers.get(key);
  }

  has(key: string): boolean {
    return this.renderers.has(key);
  }

  assertRoom(room: SectRoomDefinition): this {
    for (const actor of room.actors) {
      if (this.has(actor.conversation.renderer)) continue;
      throw new Error(
        `宗门房间 ${room.key} 的角色 ${actor.roleKey} 引用了未注册的 NPC 会话展示器：${actor.conversation.renderer}`,
      );
    }
    return this;
  }

  assertRooms(rooms: readonly SectRoomDefinition[]): this {
    for (const room of rooms) this.assertRoom(room);
    return this;
  }
}

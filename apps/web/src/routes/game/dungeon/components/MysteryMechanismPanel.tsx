import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';

type Mechanism = NonNullable<MysteryPlayerView['objects'][number]['mechanism']>;

/**
 * 机关面板：依次点选三个部件，可撤销，提交后开启或反噬。
 * 反噬多耗 1 点行动力，错满即锁死，面板上提示还能错几次。
 */
export function MysteryMechanismPanel({
  mechanism,
  processing,
  actionsLeft,
  onClose,
  onSubmit,
}: {
  mechanism: Mechanism | null;
  processing: boolean;
  actionsLeft: number;
  onClose: () => void;
  onSubmit: (mechanismId: string, sequence: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const close = () => {
    setPicked([]);
    onClose();
  };
  const labelOf = (id: string) =>
    mechanism?.parts.find((p) => p.id === id)?.label ?? id;
  const remaining = mechanism ? mechanism.maxFailures - mechanism.failures : 0;

  return (
    <InkDetailDrawer
      isOpen={mechanism !== null}
      onClose={close}
      size="sm"
      title={mechanism?.name ?? ''}
      description="依次点选三个部件，选满后确认。按对即开启；按错会反噬，多耗 1 点行动力。"
      footer={
        mechanism ? (
          <div className="flex flex-wrap gap-2">
            <InkButton
              variant="primary"
              disabled={processing || picked.length !== 3 || actionsLeft <= 0}
              onClick={() => {
                const sequence = picked;
                setPicked([]);
                void onSubmit(mechanism.id, sequence);
              }}
            >
              确认这个次序
            </InkButton>
            <InkButton
              variant="ghost"
              disabled={picked.length === 0}
              onClick={() => setPicked((prev) => prev.slice(0, -1))}
            >
              撤回一步
            </InkButton>
          </div>
        ) : null
      }
    >
      {mechanism ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {mechanism.parts.map((part) => {
              const index = picked.indexOf(part.id);
              return (
                <InkChoiceButton
                  key={part.id}
                  selected={index >= 0}
                  disabled={processing || (index < 0 && picked.length >= 3)}
                  onClick={() =>
                    index >= 0
                      ? setPicked((prev) => prev.filter((id) => id !== part.id))
                      : setPicked((prev) => [...prev, part.id])
                  }
                >
                  {index >= 0 ? `${index + 1} · ` : ''}
                  {part.label}
                </InkChoiceButton>
              );
            })}
          </div>
          <p className="text-sm">
            <span className="text-ink-secondary">次序：</span>
            {picked.length > 0 ? picked.map(labelOf).join(' → ') : '尚未选择'}
          </p>
          <p className="text-ink-secondary text-sm">
            {mechanism.failures > 0
              ? `已按错 ${mechanism.failures} 次，还能错 ${remaining} 次，错满就锁死。`
              : `最多能错 ${mechanism.maxFailures - 1} 次，错满 ${mechanism.maxFailures} 次就锁死。`}
          </p>
        </div>
      ) : null}
    </InkDetailDrawer>
  );
}

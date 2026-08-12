import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import type {
  FriendCultivatorSummary,
  FriendTargetResponse,
} from '@shared/contracts/friends';
import { useEffect, useState } from 'react';

export interface FriendTargetModalProps {
  targetId: string | null;
  onClose: () => void;
  onAdded?: (friend: FriendCultivatorSummary) => void | Promise<void>;
}

export function FriendTargetModal({
  targetId,
  onClose,
  onAdded,
}: FriendTargetModalProps) {
  const { pushToast } = useInkUI();
  const [target, setTarget] = useState<FriendCultivatorSummary | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;

    let cancelled = false;
    const loadTarget = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/friends/invite/${targetId}`);
        const data = (await response.json()) as FriendTargetResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || '查询道友失败');
        }
        if (!cancelled) {
          setTarget(data.target);
          setIsFriend(Boolean(data.isFriend));
        }
      } catch (loadError) {
        if (!cancelled) {
          setTarget(null);
          setError(
            loadError instanceof Error ? loadError.message : '查询道友失败',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTarget();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const handleAdd = async () => {
    if (!target || isFriend) return;

    try {
      setAdding(true);
      const response = await fetch(`/api/friends/${target.id}`, {
        method: 'POST',
      });
      const data = (await response.json()) as {
        friend?: FriendCultivatorSummary;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || '添加道友失败');
      }

      const friend = data.friend ?? target;
      setIsFriend(true);
      await onAdded?.(friend);
      pushToast({ message: '已加入好友名录', tone: 'success' });
    } catch (addError) {
      pushToast({
        message: addError instanceof Error ? addError.message : '添加道友失败',
        tone: 'danger',
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <InkModal isOpen={Boolean(targetId)} onClose={onClose} title="收录道友">
      {loading ? (
        <p className="py-6 text-center text-sm opacity-70">
          正在辨认玉简气息……
        </p>
      ) : error ? (
        <div className="space-y-4">
          <InkNotice tone="danger">{error}</InkNotice>
          <div className="flex justify-end">
            <InkButton onClick={onClose}>关闭</InkButton>
          </div>
        </div>
      ) : target ? (
        <div className="space-y-4">
          <InkNotice tone="muted">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{target.name}</p>
              <p className="opacity-70">
                {target.realm} {target.realmStage}
              </p>
              {target.title ? (
                <p className="opacity-70">称号：{target.title}</p>
              ) : null}
              <p className="font-mono text-xs opacity-55">
                道号标识：{target.id.slice(0, 8)}
              </p>
            </div>
          </InkNotice>
          <div className="flex justify-end gap-2">
            <InkButton onClick={onClose}>关闭</InkButton>
            <InkButton
              variant="primary"
              onClick={() => void handleAdd()}
              disabled={isFriend}
              pending={adding}
              pendingLabel="收录中……"
            >
              {isFriend ? '已在名录中' : '加入名录'}
            </InkButton>
          </div>
        </div>
      ) : null}
    </InkModal>
  );
}

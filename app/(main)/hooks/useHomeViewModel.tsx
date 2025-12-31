'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import type { InkDialogState } from '@/components/ui';
import { useAuth } from '@/lib/auth/AuthContext';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { useCallback, useMemo, useState } from 'react';

export interface UseHomeViewModelReturn {
  // 数据
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  isLoading: boolean;
  note: string | undefined;
  finalAttributes: ReturnType<typeof useCultivator>['finalAttributes'];
  unreadMailCount: number;
  isAnonymous: boolean;

  // 计算属性
  maxHp: number;
  maxSpirit: number;
  statusItems: Array<{ label: string; value: number | string; icon: string }>;

  // Dialog 状态
  dialog: InkDialogState | null;
  closeDialog: () => void;

  // 称号编辑状态
  isTitleModalOpen: boolean;
  editingTitle: string;
  isSavingTitle: boolean;
  openTitleEditor: () => void;
  closeTitleEditor: () => void;
  setEditingTitle: (title: string) => void;
  handleSaveTitle: () => Promise<void>;

  // 业务操作
  handleLogout: () => void;
  refresh: () => void;
}

const quickActionsConfig = [
  { label: '🧘 洞府', href: '/retreat' },
  { label: '🎒 储物袋', href: '/inventory' },
  { label: '📖 所修神通', href: '/skills' },
  { label: '📚 藏经阁', href: '/enlightenment' },
  { label: '🛖 修仙坊市', href: '/market' },
  { label: '⚗️ 造物仙炉', href: '/craft' },
  { label: '🏔️ 云游探秘', href: '/game/dungeon' },
  { label: '📜 版本日志', href: '/changelog' },
  { label: '🔐 神识认主', href: '/shenshi-renzhu', anonymousOnly: true },
];

export { quickActionsConfig };

/**
 * 首页 ViewModel
 * 封装所有业务逻辑和状态管理
 */
export function useHomeViewModel(): UseHomeViewModelReturn {
  const {
    cultivator,
    isLoading,
    note,
    refresh,
    finalAttributes,
    unreadMailCount,
  } = useCultivator();

  const { isAnonymous, signOut } = useAuth();
  const { pushToast } = useInkUI();

  // Dialog 状态
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 称号编辑状态
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // 计算属性
  const maxHp = finalAttributes?.maxHp ?? 100;
  const maxSpirit = finalAttributes?.maxMp ?? 100;

  const statusItems = useMemo(() => {
    if (!cultivator) return [];
    return [
      { label: '气血：', value: maxHp, icon: '❤️' },
      { label: '灵力：', value: maxSpirit, icon: '⚡️' },
      {
        label: '性别：',
        value: cultivator.gender,
        icon: cultivator.gender === '男' ? '♂' : '♀',
      },
      {
        label: '年龄：',
        value: cultivator.age,
        icon: '⌛',
      },
      { label: '寿元：', value: cultivator.lifespan, icon: '🔮' },
    ];
  }, [cultivator, maxHp, maxSpirit]);

  // 关闭 Dialog
  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  // 打开称号编辑器
  const openTitleEditor = useCallback(() => {
    setEditingTitle(cultivator?.title || '');
    setIsTitleModalOpen(true);
  }, [cultivator?.title]);

  // 关闭称号编辑器
  const closeTitleEditor = useCallback(() => {
    setIsTitleModalOpen(false);
  }, []);

  // 保存称号
  const handleSaveTitle = useCallback(async () => {
    if (!cultivator) return;

    if (
      editingTitle.length > 0 &&
      (editingTitle.length < 2 || editingTitle.length > 20)
    ) {
      pushToast({ message: '称号长度需在2-20字之间', tone: 'warning' });
      return;
    }

    try {
      setIsSavingTitle(true);
      const response = await fetch('/api/cultivator/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTitle,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存失败');
      }

      pushToast({ message: '名号已定，威震八方！', tone: 'success' });
      setIsTitleModalOpen(false);
      refresh();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '保存失败',
        tone: 'danger',
      });
    } finally {
      setIsSavingTitle(false);
    }
  }, [cultivator, editingTitle, pushToast, refresh]);

  // 登出处理
  const handleLogout = useCallback(() => {
    if (isAnonymous) {
      setDialog({
        id: 'logout-confirm',
        title: '神魂出窍',
        content: (
          <div className="space-y-2">
            <p>道友现为无名散修（游客身份）。</p>
            <p className="text-crimson">
              若是此时离去，恐将迷失在虚空之中，再也无法找回这具肉身。
            </p>
            <p>确定要神魂出窍吗？</p>
          </div>
        ),
        confirmLabel: '去意已决',
        cancelLabel: '且慢',
        onConfirm: async () => {
          await signOut();
          refresh();
        },
      });
    } else {
      signOut().then(() => refresh());
    }
  }, [isAnonymous, signOut, refresh]);

  return {
    // 数据
    cultivator,
    isLoading,
    note,
    finalAttributes,
    unreadMailCount,
    isAnonymous,

    // 计算属性
    maxHp,
    maxSpirit,
    statusItems,

    // Dialog 状态
    dialog,
    closeDialog,

    // 称号编辑状态
    isTitleModalOpen,
    editingTitle,
    isSavingTitle,
    openTitleEditor,
    closeTitleEditor,
    setEditingTitle,
    handleSaveTitle,

    // 业务操作
    handleLogout,
    refresh,
  };
}

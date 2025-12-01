'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type { Cultivator, Equipment, Skill, Consumable } from '@/types/cultivator';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const getCombatRating = (cultivator: Cultivator): string => {
  const profile = cultivator.battleProfile;
  if (!profile) return '--';
  const { vitality, spirit, wisdom, speed } = profile.attributes;
  return Math.round((vitality + spirit + wisdom + speed) / 4).toString();
};

/**
 * 首页 / 角色详情页 —— 「我的道身」
 */
export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [userCultivator, setUserCultivator] = useState<Cultivator | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateEquipment, setShowCreateEquipment] = useState(false);
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [equipmentPrompt, setEquipmentPrompt] = useState('');
  const [skillPrompt, setSkillPrompt] = useState('');
  const [inventory, setInventory] = useState<{ equipments: Equipment[]; consumables: Consumable[] }>({ equipments: [], consumables: [] });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [equippedItems, setEquippedItems] = useState<{ weapon?: string; armor?: string; accessory?: string }>({});
  const [message, setMessage] = useState<string>('');

  // 获取用户角色
  useEffect(() => {
    if (!user) return;

    const fetchUserCultivator = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/cultivators');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
          setUserCultivator(result.data[0]); // 只显示第一个角色
          await fetchInventoryAndSkills(result.data[0].id);
        } else {
          setUserCultivator(null);
        }
      } catch (error) {
        console.error('获取角色失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCultivator();
  }, [user]);

  // 获取物品栏和技能
  const fetchInventoryAndSkills = async (cultivatorId: string) => {
    try {
      // 获取物品栏
      const inventoryResponse = await fetch(`/api/cultivators/${cultivatorId}/inventory`);
      const inventoryResult = await inventoryResponse.json();
      if (inventoryResult.success) {
        setInventory(inventoryResult.data);
      }

      // 获取技能
      const skillsResponse = await fetch(`/api/create-skill?cultivatorId=${cultivatorId}`);
      const skillsResult = await skillsResponse.json();
      if (skillsResult.success) {
        setSkills(skillsResult.data);
      }

      // 获取装备状态
      const equippedResponse = await fetch(`/api/cultivators/${cultivatorId}/equip`);
      const equippedResult = await equippedResponse.json();
      if (equippedResult.success) {
        setEquippedItems(equippedResult.data);
      }
    } catch (error) {
      console.error('获取物品栏和技能失败:', error);
    }
  };

  // 删除角色（转世重修）
  const handleDeleteCultivator = async () => {
    if (!userCultivator || !confirm('确定要删除当前道身，进行转世重修吗？')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/cultivators?id=${userCultivator.id}`, { 
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // 清除角色数据
        setUserCultivator(null);
      }
    } catch (error) {
      console.error('删除角色失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成装备
  const handleCreateEquipment = async () => {
    if (!userCultivator || !equipmentPrompt.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/create-equipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: userCultivator.id,
          prompt: equipmentPrompt,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`成功炼制装备：${result.data.name}`);
        setEquipmentPrompt('');
        setShowCreateEquipment(false);
        await fetchInventoryAndSkills(userCultivator.id);
      } else {
        setMessage(`炼制失败：${result.error}`);
      }
    } catch (error) {
      console.error('生成装备失败:', error);
      setMessage('炼制失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 生成技能
  const handleCreateSkill = async () => {
    if (!userCultivator || !skillPrompt.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/create-skill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: userCultivator.id,
          prompt: skillPrompt,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`成功顿悟技能：${result.data.name}`);
        setSkillPrompt('');
        setShowCreateSkill(false);
        await fetchInventoryAndSkills(userCultivator.id);
      } else {
        setMessage(`顿悟失败：${result.error}`);
      }
    } catch (error) {
      console.error('生成技能失败:', error);
      setMessage('顿悟失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 装备/卸下装备
  const handleEquipEquipment = async (equipmentId: string) => {
    if (!userCultivator) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/cultivators/${userCultivator.id}/equip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipmentId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setEquippedItems(result.data);
        setMessage('装备操作成功');
      } else {
        setMessage(`装备操作失败：${result.error}`);
      }
    } catch (error) {
      console.error('装备操作失败:', error);
      setMessage('装备操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 生成奇遇
  const handleGenerateAdventure = async () => {
    if (!userCultivator) return;

    setLoading(true);
    try {
      const response = await fetch('/api/generate-adventure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: userCultivator.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const { adventure, reward } = result.data;
        setMessage(`奇遇：${adventure.name} - ${adventure.result}`);
        await fetchInventoryAndSkills(userCultivator.id);
      } else {
        setMessage(`奇遇生成失败：${result.error}`);
      }
    } catch (error) {
      console.error('生成奇遇失败:', error);
      setMessage('奇遇生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="bg-paper min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="bg-paper min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 顶部标题与Logo */}
        <div className="text-center mb-8">
          <div className="mb-4 h-24 w-full relative">
            <Image
              src="/assets/daoyou_logo.png"
              alt="万界道录 Logo"
              width={96}
              height={96}
              className="object-contain h-24 mx-auto"
            />
          </div>
          <h1 className="font-ma-shan-zheng text-4xl md:text-5xl text-ink mb-2">
            万界道录
          </h1>
          <p className="text-ink/70 text-center mb-8">输入心念，凝练道身</p>
        </div>
        
        {/* 主按钮区域 */}
        {!userCultivator ? (
          <div className="text-center mb-10">
            <Link
              href="/create"
              className="btn-primary inline-flex items-center justify-center"
            >
              觉醒灵根
            </Link>
          </div>
        ) : (
          <div className="text-center mb-6">
            <button
              onClick={handleDeleteCultivator}
              className="btn-outline inline-flex items-center justify-center mr-2 mb-2"
            >
              {loading ? '转世中...' : '转世重修'}
            </button>
          </div>
        )}

        {/* 成长演化功能按钮 */}
        {userCultivator && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => setShowCreateEquipment(true)}
              className="btn-primary py-3"
            >
              🔥 炼器
            </button>
            <button
              onClick={() => setShowCreateSkill(true)}
              className="btn-primary py-3"
            >
              🌌 顿悟
            </button>
            <button
              onClick={handleGenerateAdventure}
              className="btn-primary py-3"
            >
              🌀 奇遇
            </button>
          </div>
        )}

        {/* 消息提示 */}
        {message && (
          <div className="bg-ink/5 rounded-lg p-4 mb-6 text-center">
            {message}
          </div>
        )}

        {/* 角色详情 */}
        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : userCultivator ? (
          <div className="max-w-md mx-auto bg-paper-light rounded-lg p-6 shadow-sm border border-ink/10">
            <h2 className="font-ma-shan-zheng text-2xl text-ink mb-4 text-center">
              我的道身
            </h2>

            {/* 角色基本信息 */}
            <div className="mb-6">
              <h3 className="font-ma-shan-zheng text-3xl text-ink mb-2 text-center">
                {userCultivator.name}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">境界：</span>
                  <span className="text-ink font-semibold">{userCultivator.cultivationLevel}</span>
                </div>
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">灵根：</span>
                  <span className="text-ink font-semibold">{userCultivator.spiritRoot}</span>
                </div>
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">元素：</span>
                  <span className="text-ink font-semibold">{userCultivator.battleProfile?.element || '无'}</span>
                </div>
                <div className="bg-ink/5 rounded p-2">
                  <span className="text-ink/70">战力：</span>
                  <span className="text-crimson font-bold">{getCombatRating(userCultivator)}</span>
                </div>
              </div>
            </div>

            {/* 角色属性 */}
            {userCultivator.battleProfile && (
              <div className="mb-6">
                <h4 className="font-semibold text-ink mb-2">基础属性</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">体魄</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.vitality}</p>
                  </div>
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">灵力</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.spirit}</p>
                  </div>
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">悟性</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.wisdom}</p>
                  </div>
                  <div className="bg-ink/5 rounded p-2">
                    <p className="font-semibold">速度</p>
                    <p className="text-ink/80">{userCultivator.battleProfile.attributes.speed}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 先天气运 */}
            {userCultivator.preHeavenFates && userCultivator.preHeavenFates.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-ink mb-2">先天气运</h4>
                <div className="space-y-2">
                  {userCultivator.preHeavenFates.map((fate, idx) => (
                    <div key={idx} className="bg-ink/5 rounded p-2">
                      <p className="font-semibold">
                        {fate.name} · {fate.type}
                      </p>
                      <p className="text-ink/80 text-sm">{fate.effect}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 角色描述 */}
            <div className="mb-6">
              <h4 className="font-semibold text-ink mb-2">道身描述</h4>
              <p className="text-ink/90 leading-relaxed">{userCultivator.appearance}</p>
              <p className="text-ink/80 italic leading-relaxed mt-2">
                「{userCultivator.backstory}」
              </p>
            </div>

            {/* 装备管理 */}
            <div className="mb-6">
              <h4 className="font-semibold text-ink mb-2">储物袋</h4>
              {inventory.equipments.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {inventory.equipments.map((equipment) => (
                    <div key={equipment.id} className="bg-ink/5 rounded p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            {equipment.name} · {equipment.type === 'weapon' ? '武器' : equipment.type === 'armor' ? '防具' : '饰品'}
                          </p>
                          <p className="text-ink/80 text-sm">
                            元素：{equipment.element} | {equipment.specialEffect || '无特殊效果'}
                          </p>
                        </div>
                        <button
                          onClick={() => equipment.id && handleEquipEquipment(equipment.id)}
                          className={`btn-sm ${equippedItems.weapon === equipment.id || equippedItems.armor === equipment.id || equippedItems.accessory === equipment.id ? 'btn-outline' : 'btn-primary'}`}
                        >
                          {equippedItems.weapon === equipment.id || equippedItems.armor === equipment.id || equippedItems.accessory === equipment.id ? '卸下' : '装备'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ink/80">储物袋中暂无装备</p>
              )}
            </div>

            {/* 技能管理 */}
            <div className="mb-6">
              <h4 className="font-semibold text-ink mb-2">技能</h4>
              {skills.length > 0 ? (
                <div className="space-y-2">
                  {skills.map((skill, idx) => (
                    <div key={idx} className="bg-ink/5 rounded p-3">
                      <p className="font-semibold">
                        {skill.name} · {skill.type === 'attack' ? '攻击' : skill.type === 'heal' ? '治疗' : skill.type === 'control' ? '控制' : '增益'}
                      </p>
                      <p className="text-ink/80 text-sm">
                        威力：{skill.power} | 元素：{skill.element}
                      </p>
                      {skill.effects && skill.effects.length > 0 && (
                        <p className="text-ink/80 text-sm mt-1">
                          效果：{skill.effects.join('，')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ink/80">暂无技能</p>
              )}
            </div>

            {/* 消耗品管理 */}
            <div className="mb-6">
              <h4 className="font-semibold text-ink mb-2">消耗品</h4>
              {inventory.consumables.length > 0 ? (
                <div className="space-y-2">
                  {inventory.consumables.map((consumable, idx) => (
                    <div key={idx} className="bg-ink/5 rounded p-3">
                      <p className="font-semibold">{consumable.name}</p>
                      <p className="text-ink/80 text-sm">效果：{consumable.effect}</p>
                      {consumable.description && (
                        <p className="text-ink/80 text-sm mt-1">{consumable.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ink/80">暂无消耗品</p>
              )}
            </div>

            {/* 战斗按钮 */}
            <div className="text-center">
              <Link
                href={`/battle?opponent=${userCultivator.id}`}
                className="btn-primary inline-flex items-center justify-center"
              >
                入世对战
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-ink/70">
            还没有创建道身，点击上方按钮开始觉醒灵根
          </div>
        )}

        {/* 炼器弹窗 */}
        {showCreateEquipment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-paper rounded-lg p-6 max-w-md w-full">
              <h3 className="font-semibold text-xl text-ink mb-4">🔥 炼器</h3>
              <p className="text-ink/80 mb-4">请描述你想要炼制的装备，例如："炼制一把融合凤凰真火与玄冰之力的长枪"</p>
              <textarea
                value={equipmentPrompt}
                onChange={(e) => setEquipmentPrompt(e.target.value)}
                placeholder="输入装备描述..."
                className="w-full p-3 border border-ink/20 rounded-lg mb-4 h-24"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCreateEquipment(false)}
                  className="btn-outline"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateEquipment}
                  className="btn-primary"
                >
                  开始炼制
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 顿悟弹窗 */}
        {showCreateSkill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-paper rounded-lg p-6 max-w-md w-full">
              <h3 className="font-semibold text-xl text-ink mb-4">🌌 顿悟</h3>
              <p className="text-ink/80 mb-4">请描述你想要顿悟的技能，例如："在雷劫中顿悟一门攻防一体的雷遁之术"</p>
              <textarea
                value={skillPrompt}
                onChange={(e) => setSkillPrompt(e.target.value)}
                placeholder="输入技能描述..."
                className="w-full p-3 border border-ink/20 rounded-lg mb-4 h-24"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCreateSkill(false)}
                  className="btn-outline"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateSkill}
                  className="btn-primary"
                >
                  开始顿悟
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 底部链接 */}
        <div className="text-center mt-8 text-sm text-ink/50">
          <Link href="/demo" className="hover:text-ink/70 transition-colors">
            开发者 Demo →
          </Link>
        </div>
      </div>
    </div>
  );
}

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
  const [opponents, setOpponents] = useState<Cultivator[]>([]);

  // 获取用户角色和排行榜数据
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // 获取用户角色
        const cultivatorResponse = await fetch('/api/cultivators');
        const cultivatorResult = await cultivatorResponse.json();
        
        if (cultivatorResult.success && cultivatorResult.data.length > 0) {
          setUserCultivator(cultivatorResult.data[0]); // 只显示第一个角色
          await fetchInventoryAndSkills(cultivatorResult.data[0].id);
        } else {
          setUserCultivator(null);
        }
        
        // 获取排行榜数据
        const rankingsResponse = await fetch('/api/rankings');
        const rankingsResult = await rankingsResponse.json();
        
        if (rankingsResult.success) {
          setOpponents(rankingsResult.data);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
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
        await fetchInventoryAndSkills(userCultivator.id);
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
      {/* 主内容区域 */}
      <div className="container mx-auto px-4 py-8 max-w-2xl main-content">
        {/* 顶部角色状态栏 */}
        {userCultivator && (
          <div className="bg-paper-light rounded-lg p-4 mb-6 shadow-sm border border-ink/10">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <div className="mb-2 md:mb-0">
                <div className="text-lg font-semibold">
                  <span className="status-icon">☯</span>道号：{userCultivator.name}
                </div>
                <div className="text-md">
                  <span className="status-icon">🌿</span>境界：{userCultivator.cultivationLevel} · {userCultivator.spiritRoot}
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="status-icon">❤️</span>气血：{userCultivator.battleProfile?.attributes.vitality || 0}/100
                </div>
                <div>
                  <span className="status-icon">⚡</span>灵力：{userCultivator.battleProfile?.attributes.spirit || 0}/100
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 天机模块 */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-2">【天机】</h3>
          <div className="bg-paper-light rounded-lg p-4 shadow-sm border border-ink/10">
            <p className="mb-1">{'>'} 今日宜：炼器、挑战</p>
            <p>{'>'} 忌：双修（身负孤辰入命）</p>
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3">【快捷入口】</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/battle-prep" className="btn-primary py-3 text-center">
              ⚔️ 挑战天骄
            </Link>
            <Link href="#inventory" className="btn-primary py-3 text-center">
              🎒 储物袋
            </Link>
            <button onClick={() => setShowCreateSkill(true)} className="btn-primary py-3 text-center">
              📖 顿悟
            </button>
            <button onClick={() => setShowCreateEquipment(true)} className="btn-primary py-3 text-center">
              🔥 炼器
            </button>
            <button onClick={handleGenerateAdventure} className="btn-primary py-3 text-center">
              🌀 奇遇
            </button>
            <Link href="#battle-reports" className="btn-primary py-3 text-center">
              📜 战报
            </Link>
          </div>
        </div>

        {/* 近期战绩 */}
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-3">【近期战绩】</h3>
          <div className="bg-paper-light rounded-lg p-4 shadow-sm border border-ink/10">
            <div className="space-y-2">
              <p>✓ 胜 苏红袖（火凤门）</p>
              <p>✗ 败 剑无尘（天剑阁）</p>
            </div>
          </div>
        </div>

        {/* 底部引文 */}
        <div className="text-center mb-10">
          <div className="divider">
            <span className="divider-line">───────────────────────</span>
          </div>
          <p className="text-lg italic my-4">天地不仁，以万物为刍狗。</p>
          <p className="text-lg mb-4">道友，今日可要逆天改命？</p>
          <div className="divider">
            <span className="divider-line">───────────────────────</span>
          </div>
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
          <div id="character-detail" className="max-w-md mx-auto bg-paper-light rounded-lg p-6 shadow-sm border border-ink/10 mb-10">
            <h2 className="font-ma-shan-zheng text-2xl text-ink mb-4 text-center">
              道我真形
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

            {/* 先天气运 */}
            {userCultivator.preHeavenFates && userCultivator.preHeavenFates.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-ink mb-3">【先天命格】</h4>
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

            {/* 根基属性 */}
            {userCultivator.battleProfile && (
              <div className="mb-6">
                <h4 className="font-semibold text-ink mb-3">【根基属性】</h4>
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

            {/* 当前所御法宝 */}
            <div className="mb-6">
              <h4 className="font-semibold text-ink mb-3">【当前所御法宝】</h4>
              <div className="space-y-2">
                {inventory.equipments.filter(equip => 
                  equippedItems.weapon === equip.id || 
                  equippedItems.armor === equip.id || 
                  equippedItems.accessory === equip.id
                ).map((equipment) => (
                  <div key={equipment.id} className="bg-ink/5 rounded p-3">
                    <div>
                      <p className="font-semibold">
                        {equipment.type === 'weapon' ? '🗡️ 武器' : equipment.type === 'armor' ? '🛡️ 护甲' : '📿 饰品'}：{equipment.name}
                      </p>
                      <p className="text-ink/80 text-sm">
                        {equipment.element}·{equipment.quality}｜{equipment.specialEffect || '无特殊效果'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center mt-4">
                <Link href="#inventory" className="text-crimson hover:underline">
                  [前往储物袋更换装备 →]
                </Link>
              </div>
            </div>

            {/* 所修神通 */}
            <div className="mb-6">
              <h4 className="font-semibold text-ink mb-3">【所修神通】</h4>
              <div className="space-y-2">
                {skills.map((skill, idx) => (
                  <div key={idx} className="bg-ink/5 rounded p-3">
                    <div>
                      <p className="font-semibold">
                        {skill.type === 'attack' ? '⚡ 攻击' : skill.type === 'heal' ? '❤️ 治疗' : skill.type === 'control' ? '🌀 控制' : '✨ 增益'}：{skill.name}
                      </p>
                      <p className="text-ink/80 text-sm">
                        威力：{skill.power}｜元素：{skill.element}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center mt-4">
                <button 
                  onClick={() => setShowCreateSkill(true)} 
                  className="text-crimson hover:underline"
                >
                  [闭关顿悟新神通 →]
                </button>
              </div>
            </div>

            {/* 底部导航 */}
            <div className="flex justify-between mt-6">
              <Link href="/" className="text-ink hover:underline">[← 返回主界]</Link>
              <button className="text-ink hover:underline">[推演战力]</button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-ink/70">
            还没有创建道身，点击上方按钮开始觉醒灵根
          </div>
        )}

        {/* 储物袋界面 */}
        {userCultivator && (
          <div id="inventory" className="mb-10">
            <h3 className="font-semibold text-xl mb-4">【储物袋 · 共 {inventory.equipments.length} 件法宝】</h3>
            <div className="bg-paper-light rounded-lg p-4 shadow-sm border border-ink/10">
              {inventory.equipments.length > 0 ? (
                <div className="space-y-3">
                  {inventory.equipments.map((equipment) => (
                    <div 
                      key={equipment.id} 
                      className={`item-card ${equippedItems.weapon === equipment.id || equippedItems.armor === equipment.id || equippedItems.accessory === equipment.id ? 'item-card-equipped' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            {equipment.type === 'weapon' ? '🗡️ 武器' : equipment.type === 'armor' ? '🛡️ 护甲' : '📿 饰品'}：{equipment.name}
                            {equippedItems.weapon === equipment.id || equippedItems.armor === equipment.id || equippedItems.accessory === equipment.id && (
                              <span className="equipped-mark">← 已装备</span>
                            )}
                          </p>
                          <p className="item-description">
                            {equipment.element}·{equipment.quality}｜{equipment.specialEffect || '无特殊效果'}
                          </p>
                        </div>
                        <button
                          onClick={() => equipment.id && handleEquipEquipment(equipment.id)}
                          className="btn-primary btn-sm"
                        >
                          {equippedItems.weapon === equipment.id || equippedItems.armor === equipment.id || equippedItems.accessory === equipment.id ? '卸下' : '装备'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">储物袋空空如也，道友该去寻宝了。</div>
              )}
              
              <div className="flex justify-between mt-6">
                <Link href="/" className="text-ink hover:underline">[返回主界]</Link>
                <button className="text-ink hover:underline">[整理法宝]</button>
              </div>
            </div>
          </div>
        )}

        {/* 技能/神通界面 */}
        {userCultivator && (
          <div id="skills" className="mb-10">
            <h3 className="font-semibold text-xl mb-4">【所修神通 · 共 {skills.length}/3】</h3>
            <div className="bg-paper-light rounded-lg p-4 shadow-sm border border-ink/10">
              {skills.length > 0 ? (
                <div className="space-y-3">
                  {skills.map((skill, idx) => (
                    <div key={idx} className="item-card">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">
                            {skill.type === 'attack' ? '⚡ 攻击' : skill.type === 'heal' ? '❤️ 治疗' : skill.type === 'control' ? '🌀 控制' : '✨ 增益'}：{skill.name}
                            {idx === 0 && <span className="new-mark">← 新悟</span>}
                          </p>
                          <p className="item-description">
                            威力：{skill.power}｜元素：{skill.element}
                          </p>
                        </div>
                        <button className="btn-outline btn-sm">[替换]</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">暂无神通，快去闭关顿悟吧。</div>
              )}
              
              <div className="flex justify-between mt-6">
                <Link href="/" className="text-ink hover:underline">[返回]</Link>
                <button 
                  onClick={() => setShowCreateSkill(true)} 
                  className="text-crimson hover:underline"
                >
                  [闭关顿悟新神通 →]
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部固定导航栏 */}
      <div className="bottom-nav">
        <Link href="/" className="bottom-nav-item active">首页</Link>
        <Link href="#inventory" className="bottom-nav-item">储物</Link>
        <Link href="#skills" className="bottom-nav-item">神通</Link>
        <Link href="/battle-prep" className="bottom-nav-item">天机榜</Link>
      </div>

      {/* 炼器弹窗 */}
      {showCreateEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-paper rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold text-xl text-ink mb-4">🔥 炼器</h3>
            <p className="text-ink/80 mb-4">请描述你想要炼制的装备，例如：&quot;炼制一把融合凤凰真火与玄冰之力的长枪&quot;</p>
            <textarea
              value={equipmentPrompt}
              onChange={(e) => setEquipmentPrompt(e.target.value)}
              placeholder="输入装备描述..."
              className="textarea-large"
            />
            <div className="flex justify-end space-x-2 mt-4">
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
              className="textarea-large"
            />
            <div className="flex justify-end space-x-2 mt-4">
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
    </div>
  );
}

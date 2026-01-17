'use client';

import { useEffect, useState } from 'react';

// 预生成的粒子数据（静态值避免随机性问题）
const STATIC_PARTICLES = [
  { id: 0, left: 5, delay: 0.2, duration: 7 },
  { id: 1, left: 12, delay: 1.5, duration: 8 },
  { id: 2, left: 20, delay: 0.8, duration: 6.5 },
  { id: 3, left: 28, delay: 2.1, duration: 9 },
  { id: 4, left: 35, delay: 0.5, duration: 7.5 },
  { id: 5, left: 42, delay: 3.2, duration: 8.5 },
  { id: 6, left: 50, delay: 1.8, duration: 6 },
  { id: 7, left: 58, delay: 4.1, duration: 9.5 },
  { id: 8, left: 65, delay: 0.3, duration: 7.2 },
  { id: 9, left: 72, delay: 2.8, duration: 8.8 },
  { id: 10, left: 78, delay: 1.2, duration: 6.8 },
  { id: 11, left: 85, delay: 3.5, duration: 7.8 },
  { id: 12, left: 92, delay: 0.9, duration: 9.2 },
  { id: 13, left: 8, delay: 4.5, duration: 6.2 },
  { id: 14, left: 25, delay: 2.5, duration: 8.2 },
  { id: 15, left: 48, delay: 1.0, duration: 7.3 },
  { id: 16, left: 62, delay: 3.8, duration: 6.7 },
  { id: 17, left: 75, delay: 0.6, duration: 9.8 },
  { id: 18, left: 88, delay: 2.3, duration: 7.7 },
  { id: 19, left: 95, delay: 4.0, duration: 8.3 },
];

/**
 * 灵气粒子组件
 * 客户端组件，处理动画效果
 */
export function SpiritParticles() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 延迟挂载以确保动画正确播放
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <div className="spirit-particles" aria-hidden="true" />;
  }

  return (
    <div className="spirit-particles" aria-hidden="true">
      {STATIC_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="spirit-particle"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

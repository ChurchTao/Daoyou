/**
 * SVG 图标组件
 * 包含丹炉、云纹、印章等修仙风格图标
 */

/**
 * 丹炉图标（带冒烟动画）
 */
export function AlchemyFurnaceIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 炉体 */}
      <rect x="6" y="12" width="12" height="8" rx="2" fill="#8b4513" />
      <rect x="8" y="14" width="8" height="4" rx="1" fill="#a0522d" />
      {/* 炉口 */}
      <ellipse cx="12" cy="12" rx="4" ry="2" fill="#654321" />
      {/* 三足 */}
      <path d="M8 20 L6 24 M12 20 L12 24 M16 20 L18 24" stroke="#654321" strokeWidth="2" />
      {/* 冒烟 */}
      <circle cx="10" cy="8" r="1.5" fill="#5a4a42" opacity="0.6" className="smoke" />
      <circle cx="12" cy="6" r="1" fill="#5a4a42" opacity="0.5" className="smoke" style={{ animationDelay: '0.3s' }} />
      <circle cx="14" cy="8" r="1.5" fill="#5a4a42" opacity="0.6" className="smoke" style={{ animationDelay: '0.6s' }} />
    </svg>
  );
}

/**
 * 火焰图标
 */
export function FlameIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#c1121f" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 C10 4, 8 6, 8 10 C8 12, 9 13, 10 12 C10 14, 11 15, 12 14 C12 16, 13 17, 14 16 C14 18, 15 19, 16 18 C16 20, 17 21, 18 20 C18 22, 19 23, 20 22 L20 24 L4 24 L4 22 C5 23, 6 22, 6 20 C6 18, 7 17, 8 16 C8 14, 9 13, 10 14 C10 12, 11 11, 12 12 C12 10, 13 9, 14 10 C14 8, 15 7, 16 8 C16 6, 17 5, 18 6 C18 4, 19 3, 20 4 L20 2 Z" />
    </svg>
  );
}

/**
 * 胜利印章（"胜"字）
 */
export function VictorySeal({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="#c1121f" opacity="0.8" xmlns="http://www.w3.org/2000/svg">
      {/* 印章边框 */}
      <rect x="5" y="5" width="90" height="90" rx="5" fill="none" stroke="#c1121f" strokeWidth="3" />
      {/* "胜"字（简化版） */}
      <text x="50" y="60" fontSize="50" fill="#c1121f" textAnchor="middle" fontFamily="serif" fontWeight="bold">胜</text>
    </svg>
  );
}

/**
 * 云纹分隔线 SVG
 */
export function CloudDivider({ className = "w-full h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M0,20 Q50,10 100,20 T200,20" 
        stroke="#2c1810" 
        strokeWidth="1" 
        fill="none" 
        opacity="0.2"
      />
      <path 
        d="M0,25 Q50,15 100,25 T200,25" 
        stroke="#2c1810" 
        strokeWidth="1" 
        fill="none" 
        opacity="0.15"
      />
    </svg>
  );
}


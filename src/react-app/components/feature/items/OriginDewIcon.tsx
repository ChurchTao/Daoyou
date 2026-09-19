/** 两档灵露共用瓶形，仅随策划配置改变色彩。 */
export function OriginDewIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="1em"
      height="1em"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path d="M19 4h10v5H19z" fill="currentColor" />
      <path
        d="M19 9v9C12 22 9 28 10 36c1 6 6 8 14 8s13-2 14-8c1-8-2-14-9-18V9"
        fill="currentColor"
        fillOpacity=".13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 30c5-3 8 3 13 0s8-2 11 0v6c-1 4-5 6-12 6s-11-2-12-6z"
        fill="currentColor"
        fillOpacity=".65"
      />
      <path
        d="M18 13h12M17 17h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M24 23c-2 3-4 5-4 7a4 4 0 0 0 8 0c0-2-2-4-4-7Z"
        fill="currentColor"
      />
      <path
        d="M16 25c-2 3-3 6-2 9"
        stroke="currentColor"
        strokeOpacity=".4"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

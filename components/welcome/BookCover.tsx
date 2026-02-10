import { cn } from '@/lib/utils';

interface BookCoverProps {
  onClick?: () => void;
  className?: string;
}

/**
 * 古籍封面组件
 * 显示古籍封面，点击后触发翻页
 */
export function BookCover({ onClick, className }: BookCoverProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'book-cover relative flex flex-col items-center justify-center',
        'min-h-screen w-full cursor-pointer',
        'bg-paper',
        'border-4 border-amber-900/30',
        'shadow-2xl',
        onClick && 'hover:shadow-3xl transition-shadow duration-500',
        className,
      )}
    >
      {/* 书名框 */}
      <div className="book-title-frame relative border-4 border-double border-amber-900/50 bg-white/40 p-8 backdrop-blur-sm md:p-12">
        {/* 装饰性角纹 */}
        <div className="absolute -top-2 -left-2 h-6 w-6 border-t-2 border-l-2 border-amber-900/70" />
        <div className="absolute -top-2 -right-2 h-6 w-6 border-t-2 border-r-2 border-amber-900/70" />
        <div className="absolute -bottom-2 -left-2 h-6 w-6 border-b-2 border-l-2 border-amber-900/70" />
        <div className="absolute -right-2 -bottom-2 h-6 w-6 border-r-2 border-b-2 border-amber-900/70" />

        {/* 书名 - 使用 Ma Shan Zheng 字体 */}
        <h1 className="font-ma-shan-zheng mb-4 text-center text-5xl tracking-widest text-amber-900 md:text-7xl">
          万界道友录
        </h1>

        {/* 副标题 - 使用 LXGWWenKai 字体 */}
        <p className="text-center text-lg tracking-wide text-amber-800/80 md:text-xl">
          修真实录·卷一
        </p>
      </div>

      {/* 提示文字 */}
      {onClick && (
        <div className="absolute right-0 bottom-12 left-0 text-center">
          <p className="animate-pulse text-sm text-amber-800/60 md:text-base">
            轻触翻开此卷
          </p>
        </div>
      )}

      {/* 古籍边缘效果 */}
      <div className="pointer-events-none absolute inset-0 border-4 border-amber-900/10 shadow-inner" />
    </div>
  );
}

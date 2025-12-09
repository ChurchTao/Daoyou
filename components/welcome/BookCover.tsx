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
      <div className="book-title-frame relative border-4 border-double border-amber-900/50 p-8 md:p-12 bg-white/40 backdrop-blur-sm">
        {/* 装饰性角纹 */}
        <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-amber-900/70" />
        <div className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2 border-amber-900/70" />
        <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2 border-amber-900/70" />
        <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-amber-900/70" />

        {/* 书名 - 使用 Ma Shan Zheng 字体 */}
        <h1 className="text-5xl md:text-7xl font-ma-shan-zheng text-amber-900 tracking-widest text-center mb-4">
          万界道友录
        </h1>

        {/* 副标题 - 使用 LXGWWenKai 字体 */}
        <p className="text-lg md:text-xl text-amber-800/80 text-center tracking-wide">
          修真实录·卷一
        </p>
      </div>

      {/* 提示文字 */}
      {onClick && (
        <div className="absolute bottom-12 left-0 right-0 text-center">
          <p className="text-amber-800/60 text-sm md:text-base animate-pulse">
            轻触翻开此卷
          </p>
        </div>
      )}

      {/* 古籍边缘效果 */}
      <div className="absolute inset-0 pointer-events-none border-4 border-amber-900/10 shadow-inner" />
    </div>
  );
}

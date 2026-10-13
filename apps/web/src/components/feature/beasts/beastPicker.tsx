import { InkButton } from '@app/components/ui/InkButton';
import { BEAST_PICKER_PAGE_SIZE } from '@daoyou/contracts/beasts';

export function BeastPickerPager({
  page,
  total,
  loading,
  onPage,
}: {
  page: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  if (total <= BEAST_PICKER_PAGE_SIZE) return null;
  const pages = Math.max(1, Math.ceil(total / BEAST_PICKER_PAGE_SIZE));
  return (
    <div className="flex flex-nowrap items-center justify-between gap-1 pt-2">
      <InkButton
        className="shrink-0 px-0 tracking-normal"
        disabled={loading || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        上一页
      </InkButton>
      <span className="text-ink-secondary shrink-0 font-mono text-sm whitespace-nowrap">
        {page} / {pages}
      </span>
      <InkButton
        className="shrink-0 px-0 tracking-normal"
        disabled={loading || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        下一页
      </InkButton>
    </div>
  );
}

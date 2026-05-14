import Link from '@app/components/router/AppLink';
import { cn } from '@shared/lib/cn';

interface AuthChoiceCardProps {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: 'default' | 'primary';
}

export function AuthChoiceCard({
  title,
  description,
  href,
  onClick,
  disabled = false,
  accent = 'default',
}: AuthChoiceCardProps) {
  const className = cn(
    'group block w-full border border-dashed p-4 text-left no-underline transition-colors duration-200',
    'border-ink/18 bg-transparent hover:border-crimson/35',
    accent === 'primary' && 'border-crimson/35',
    disabled && 'pointer-events-none opacity-55',
  );

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-heading text-ink text-xl">{title}</p>
        <p className="text-ink-secondary mt-1 text-sm leading-6">
          {description}
        </p>
      </div>
      <span className="text-crimson/80 text-sm">[进入]</span>
    </div>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {content}
    </button>
  );
}

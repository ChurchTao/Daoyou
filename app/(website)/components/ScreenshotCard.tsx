import type { Screenshot } from '@/data/screenshot';
import Image from 'next/image';

interface ScreenshotCardProps {
  screenshot: Screenshot;
  index: number;
}

export function ScreenshotCard({ screenshot, index }: ScreenshotCardProps) {
  return (
    <figure
      className="screenshot-card-enhanced ancient-border group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="bg-ink/5 relative aspect-[9/16] w-full overflow-hidden">
        <Image
          src={screenshot.url}
          alt={screenshot.alt}
          fill
          unoptimized
          sizes="(min-width: 1024px) 400px, (min-width: 768px) 350px, 100vw"
          className="screenshot-image-enhanced object-contain"
          loading="lazy"
        />
        {/* Hover Overlay */}
        <div className="screenshot-hover-overlay absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300">
          <svg
            className="text-paper h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </div>
      </div>
      {(screenshot.alt || screenshot.description) && (
        <figcaption className="screenshot-caption-enhanced">
          <span className="text-ink font-medium">{screenshot.alt}</span>
          {screenshot.description && (
            <span className="text-ink-muted mt-1 block text-xs">
              {screenshot.description}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

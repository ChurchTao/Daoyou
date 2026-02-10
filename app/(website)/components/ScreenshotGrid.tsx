import type { Screenshot } from '@/data/screenshot';
import { ScreenshotCard } from './ScreenshotCard';

interface ScreenshotGridProps {
  screenshots: Screenshot[];
}

export function ScreenshotGrid({ screenshots }: ScreenshotGridProps) {
  return (
    <div className="screenshot-masonry">
      {screenshots.map((screenshot, index) => (
        <ScreenshotCard
          key={screenshot.url}
          screenshot={screenshot}
          index={index}
        />
      ))}
    </div>
  );
}

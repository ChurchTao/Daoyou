'use client';

import { useState, useMemo } from 'react';
import {
  screenshots as screenshotGroups,
  screenshotCategories,
  type Screenshot,
} from '@/data/screenshot';
import { CategoryTabs } from './CategoryTabs';
import { ScreenshotGrid } from './ScreenshotGrid';

export function ScreenshotGallery() {
  const [activeCategory, setActiveCategory] = useState('all');

  // Flatten all screenshots with explicit type
  const allScreenshots: Screenshot[] = useMemo(() => {
    return screenshotGroups.flatMap((group) => group.screenshots);
  }, []);

  // Filter screenshots by category
  const filteredScreenshots = useMemo(() => {
    if (activeCategory === 'all') {
      return allScreenshots;
    }
    return allScreenshots.filter((s) => s.category === activeCategory);
  }, [activeCategory, allScreenshots]);

  // Calculate counts for each category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allScreenshots.length,
    };

    screenshotCategories.forEach((cat) => {
      if (cat.id !== 'all') {
        counts[cat.id] = allScreenshots.filter((s) => s.category === cat.id)
          .length;
      }
    });

    return counts;
  }, [allScreenshots]);

  return (
    <div className="screenshot-gallery">
      <CategoryTabs
        categories={screenshotCategories}
        activeCategory={activeCategory}
        counts={categoryCounts}
        onCategoryChange={setActiveCategory}
      />

      <ScreenshotGrid screenshots={filteredScreenshots} />
    </div>
  );
}

import type { ScreenshotCategory } from '@/data/screenshot';

interface CategoryTabsProps {
  categories: ScreenshotCategory[];
  activeCategory: string;
  counts: Record<string, number>;
  onCategoryChange: (categoryId: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  counts,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="category-tabs-container mb-10">
      <div className="category-tabs">
        {categories.map((category) => {
          const count = counts[category.id] || 0;
          const isActive = activeCategory === category.id;

          return (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={`category-tab ${isActive ? 'category-tab-active' : ''}`}
              aria-pressed={isActive}
              aria-label={`筛选 ${category.label} 截图`}
            >
              <span className="category-tab-icon" aria-hidden="true">
                {category.icon}
              </span>
              <span className="category-tab-label">{category.label}</span>
              <span className="category-tab-count" aria-hidden="true">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

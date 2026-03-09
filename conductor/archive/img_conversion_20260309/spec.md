# 规范：将所有的 next/image 替换为 img 标签

## 1. 概述 (Overview)
本 Track 的目标是将项目中所有的 `next/image` 替换为标准的 `<img>` 标签。用户明确表示不需要进行任何优化（如图像缩放、延迟加载优化等）。

## 2. 功能需求 (Functional Requirements)
- **全局替换**: 扫描项目中所有文件的 `next/image` 导入和用法。
- **标签转换**:
  - 将 `<Image />` 组件替换为 `<img>`。
  - 删除 `next/image` 的导入。
- **属性映射**:
  - 保留: `src`, `alt`, `width`, `height`, `className`, `id`, `style`。
  - 丢弃: `priority`, `placeholder`, `quality`, `sizes`, `fill`, `loader`, `unoptimized`, `blurDataURL`, `loading`。
- **样式处理**:
  - 确保生成的 `<img>` 标签保留相同的 `className` 和 `style`，以最大程度减少布局偏移。
  - 如果使用了 `fill` 属性，则替换为相应的 CSS（例如：`object-fit: cover; width: 100%; height: 100%;`）。

## 3. 非功能需求 (Non-Functional Requirements)
- **布局一致性**: 变更不应导致现有的 UI 布局出现明显破坏。
- **构建性能**: 由于绕过了 Next.js 的图像优化，构建过程可能会更快。

## 4. 验收标准 (Acceptance Criteria)
- 所有的 `<Image />` 组件均已替换为 `<img>`。
- 代码库中不再存在 `next/image` 导入。
- 应用程序构建并运行成功。
- 视觉检查显示图像布局没有明显退化。

## 5. 超出范围 (Out of Scope)
- 添加新的图像优化。
- 更改图像源或资源文件。

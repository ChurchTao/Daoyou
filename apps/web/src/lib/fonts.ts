// Register the full character coverage first. The interface subsets below
// override matching ranges so common UI text needs fewer font requests.
import '../assets/fonts/LXGWWenKaiLite-Regular.ttf';
import {
  fontFamilyFallback as bodyFallback,
  css as bodyFont,
} from '../assets/fonts/LXGWWenKaiLite-Regular.ttf?subsets';
import '../assets/fonts/MaShanZheng-Regular.ttf';
import {
  fontFamilyFallback as headingFallback,
  css as headingFont,
} from '../assets/fonts/MaShanZheng-Regular.ttf?subsets';

export const bodyFontFamily = bodyFont.family;
export const bodyFontStack = `"${bodyFont.family}", ${bodyFallback}`;

document.documentElement.style.setProperty('--font-lxgwwenkai', bodyFontStack);
document.documentElement.style.setProperty(
  '--font-ma-shan-zheng',
  `"${headingFont.family}", ${headingFallback}`,
);

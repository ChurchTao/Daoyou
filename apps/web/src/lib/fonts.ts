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
// Canvas labels use the Chinese face only. System emoji fonts sit after it so
// incidental emoji are not taken by the YaHei metric fallback.
export const bodyFontStack = `"${bodyFont.family}", ${bodyFallback}`;

const systemEmojiFamilies =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';

function textFontStack(family: string, metricFallback: string) {
  return `"${family}", ${systemEmojiFamilies}, ${metricFallback}`;
}

document.documentElement.style.setProperty(
  '--font-lxgwwenkai',
  textFontStack(bodyFont.family, bodyFallback),
);
document.documentElement.style.setProperty(
  '--font-ma-shan-zheng',
  textFontStack(headingFont.family, headingFallback),
);

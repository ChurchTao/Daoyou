import { TYPE_DESCRIPTIONS } from './config';
import type { MaterialSkeleton } from './types';

export function getMaterialGenerationPrompt(
  skeletons: MaterialSkeleton[],
): string {
  // 构建待生成列表描述
  const reqList = skeletons
    .map((s, i) => {
      const typeDesc = TYPE_DESCRIPTIONS[s.type];
      const elementReq = s.forcedElement
        ? `指定属性：${s.forcedElement}`
        : '属性：由你决定';
      return `${i + 1}. 类型：${typeDesc} | 品质：${s.rank} | ${elementReq}`;
    })
    .join('\n');

  const themes = [
    '上古遗迹风格',
    '域外天魔风格',
    '自然造化风格',
    '极简玄奥风格',
    '繁复华丽风格',
    '邪异莫测风格',
    '浩然正气风格',
    '市井奇缘风格',
  ];
  const randomTheme = themes[Math.floor(Math.random() * themes.length)];

  return `你是一个修仙世界的「天道」系统。请为以下 ${skeletons.length} 个生成的材料骨架赋予富有仙侠气息的名称、描述和五行属性。
本次生成的主题偏好为：【${randomTheme}】。

【生成要求】
1. **名称**：2-8字，古朴玄奥，符合《凡人修仙传》风格。
   - 药材如：赤炎藤、九叶灵芝
   - 矿石如：玄冥铁、庚金
   - 妖兽材料如：墨蛟鳞片、裂风兽内丹
   - 功法典籍:
     - 结构多样：[前缀][修饰][后缀]。后缀可使用：诀、经、典、录、心法、秘籍、神诀、真解、残篇、宝鉴、卷。
2. **描述**：30-60字，简述外形、产地或用途，略带主题相关的氛围感。
3. **五行属性**：
   - 如果骨架中指定了属性，必须严格遵循。
   - 如果未指定，请根据名称自动判定（金/木/水/火/土/风/雷/冰）。
4. **品质对应**：名称的霸气程度和描述的玄妙程度应与品质（凡/灵/玄/真/地/天/仙/神）相匹配。

【待生成列表】
${reqList}

请直接输出一个 JSON 数组，包含 ${skeletons.length} 个对象，每个对象有 name, description, element 三个字段。`;
}

export function getMaterialGenerationUserPrompt() {
  return `请生成 JSON 数组。`;
}

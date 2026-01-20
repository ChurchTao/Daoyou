import { TYPE_DESCRIPTIONS } from './config';
import type { MaterialSkeleton } from './types';

export function getMaterialGenerationPrompt(
  skeletons: MaterialSkeleton[],
): string {
  // 构建待生成列表描述
  const reqList = skeletons
    .map((s, i) => {
      const typeDesc = TYPE_DESCRIPTIONS[s.type];
      const elementReq = s.forcedElement ? `指定属性：${s.forcedElement}` : '属性：由你决定';
      return `${i + 1}. 类型：${typeDesc} | 品质：${s.rank} | ${elementReq}`;
    })
    .join('\n');

  return `你是一个修仙世界的「天道」系统。请为以下 ${skeletons.length} 个生成的材料骨架赋予富有仙侠气息的名称、描述和五行属性。

【生成要求】
1. **名称**：2-8字，古朴玄奥，符合《凡人修仙传》风格。
   - 药材如：赤炎藤、九叶灵芝
   - 矿石如：玄冥铁、庚金
   - 妖兽材料如：墨蛟鳞片、裂风兽内丹
2. **描述**：30-60字，简述外形、产地或用途，略带沧桑感。
3. **五行属性**：
   - 如果骨架中指定了属性，必须严格遵循。
   - 如果未指定，请根据你生成的名称和描述，自动判定最合适的属性（金/木/水/火/土/风/雷/冰）。例如“赤炎藤”应为“火”，“庚金”应为“金”。
4. **严格对应**：必须严格按照输入的顺序生成，不得改变顺序。

【待生成列表】
${reqList}

请直接输出一个 JSON 数组，包含 ${skeletons.length} 个对象，每个对象有 name, description, element 三个字段。`;
}

export function getMaterialGenerationUserPrompt() {
  return `请生成 JSON 数组。`;
}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const genericFiles = [
  'src/shared/engine/sect/types.ts',
  'src/shared/engine/sect/compiler.ts',
  'src/shared/engine/sect/registry.ts',
  'src/shared/engine/sect/runtime.ts',
  'src/shared/engine/sect/runtimeFactory.ts',
  'src/server/lib/services/SectService.ts',
  'src/server/lib/repositories/sectRepository.ts',
  'src/server/routes/api/sects.router.ts',
  'src/shared/contracts/sect.ts',
  'src/react-app/routes/game/sect/route.tsx',
  'src/react-app/routes/game/sect/abilities/route.tsx',
];

describe('宗门插件架构守卫', () => {
  it('通用层不引用任何生产宗门、流派或测试宗门ID', () => {
    for (const file of genericFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/lingxiao|swift-sword|heavy-sword|fixture-sect/);
    }
  });

  it('测试宗门没有注册进生产目录', () => {
    const catalog = readFileSync(resolve(process.cwd(), 'src/shared/engine/sect/catalog.ts'), 'utf8');
    expect(catalog).not.toContain('FIXTURE_SECT_MODULE');
    expect(catalog).not.toContain('fixture-sect');
  });
});


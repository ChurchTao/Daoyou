import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'src/shared/engine/sect');
const battleRoot = resolve(process.cwd(), 'src/shared/engine/battle-v5');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(name)
        ? [path]
        : [];
  });
}

describe('宗门插件架构守卫', () => {
  it('根目录只保留公共入口、说明和分层目录', () => {
    expect(readdirSync(root).sort()).toEqual(
      ['README.md', 'content', 'core', 'index.ts', 'testing'].sort(),
    );
  });

  it('通用核心不依赖具体宗门、流派、节点或内容目录', () => {
    for (const file of sourceFiles(join(root, 'core')).filter(
      (path) => !path.includes('/tests/'),
    )) {
      const source = readFileSync(file, 'utf8');
      const label = relative(root, file);
      expect(source, label).not.toMatch(
        /lingxiao|swift-sword|heavy-sword|fixture-sect/,
      );
      expect(source, label).not.toMatch(/from ['"][^'"]*content/);
      expect(source, label).not.toContain('paths[0]');
    }
    const publicEntry = readFileSync(join(root, 'index.ts'), 'utf8');
    expect(publicEntry).not.toMatch(
      /lingxiao|(?:export|import)[^\n]*from ['"]\.\/content/,
    );
  });

  it('battle-v5 通用引擎不依赖幽都宗门或其内容 ID', () => {
    for (const file of sourceFiles(battleRoot).filter(
      (path) => !path.includes('/tests/'),
    )) {
      const source = readFileSync(file, 'utf8');
      const label = relative(process.cwd(), file);
      expect(source, label).not.toMatch(/youdu|幽都|sect\.youdu/i);
    }
  });

  it('流派基础编译器不按节点ID集中分派', () => {
    for (const file of [
      join(root, 'content/lingxiao/paths/swift/variants.ts'),
      join(root, 'content/lingxiao/paths/heavy/variants.ts'),
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, relative(root, file)).not.toMatch(/nodes\.has\s*\(/);
      expect(source, relative(root, file)).not.toMatch(
        /if\s*\([^)]*(swift-|heavy-)/,
      );
      expect(source, relative(root, file)).not.toContain('path.level');
    }
  });

  it('通用核心不固定流派层数或每层节点数', () => {
    for (const file of sourceFiles(join(root, 'core')).filter(
      (path) => !path.includes('/tests/'),
    )) {
      const source = readFileSync(file, 'utf8');
      expect(source, relative(root, file)).not.toMatch(
        /EXPECTED_LAYERS|固定六层|必须恰有3个节点/,
      );
    }
  });

  it('测试宗门不会进入生产组合根', () => {
    const production = readFileSync(
      join(root, 'content/productionRuntime.ts'),
      'utf8',
    );
    expect(production).not.toMatch(/fixture|testing/);
  });

  it('红尘剑宗内容不手写神通详情或启动期组合穷举', () => {
    const contentRoot = join(root, 'content/lingxiao');
    for (const file of sourceFiles(contentRoot).filter(
      (path) => !path.includes('/tests/'),
    )) {
      const source = readFileSync(file, 'utf8');
      const label = relative(root, file);
      expect(source, label).not.toContain('detailRows');
    }
    const compilationRule = readFileSync(
      join(root, 'core/validation/SectCompilationRule.ts'),
      'utf8',
    );
    expect(compilationRule).not.toMatch(/compileCombination|JSON\.stringify/);
  });

  it('通用宗门前端不依赖具体宗门或固定内容数量', () => {
    const frontendRoots = [
      resolve(process.cwd(), 'src/react-app/routes/game/sect'),
      resolve(process.cwd(), 'src/react-app/components/feature/sect'),
      resolve(process.cwd(), 'src/react-app/lib/sect'),
    ];
    for (const file of frontendRoots
      .flatMap(sourceFiles)
      .filter((path) => !/\.test\.(ts|tsx)$/.test(path))) {
      const source = readFileSync(file, 'utf8');
      const label = relative(process.cwd(), file);
      expect(source, label).not.toMatch(
        /lingxiao|凌霄|红尘剑宗|剑道|剑路|剑痕|九门|六层|藏经阁|剑录阁|悟道崖|照影崖|演武台|试剑台|执事堂|百业院|云阶扫叶|山阶扫叶/,
      );
      expect(source, label).not.toMatch(
        /presentation\/lingxiao|\[null, null, null, null\]|\[1, 2, 3\]/,
      );
    }
  });
});

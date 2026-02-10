import {
  extractTemplateVariables,
  normalizeTemplatePayload,
  renderTemplate,
} from './template';

describe('admin template utils', () => {
  it('extracts variables from template', () => {
    const vars = extractTemplateVariables('你好 {{name}}，奖励 {{count}} 灵石');
    expect(vars.sort()).toEqual(['count', 'name']);
  });

  it('renders template with variables', () => {
    const text = renderTemplate('版本 {{version}} 已上线', {
      version: 'v1.2.3',
    });
    expect(text).toBe('版本 v1.2.3 已上线');
  });

  it('throws when variables are missing', () => {
    expect(() => renderTemplate('你好 {{name}}', {})).toThrow('模板变量缺失');
  });

  it('normalizes default + input payload', () => {
    const payload = normalizeTemplatePayload(
      { version: 'v1', count: 1, ignored: { a: 1 } },
      { count: 3, title: '公告' },
    );

    expect(payload).toEqual({
      version: 'v1',
      count: 3,
      title: '公告',
    });
  });
});

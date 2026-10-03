import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type SponsorTier = {
  id: string;
  name: string;
  description: string;
  order: number;
};

type Sponsor = {
  id: string;
  name: string;
  kind: 'person' | 'organization';
  tier: string;
  since: string;
  endedAt: string | null;
  blessing: string;
  url: string | null;
  avatar: string | null;
};

type SponsorData = {
  version: 1;
  updatedAt: string;
  sponsorUrl: string;
  tiers: SponsorTier[];
  sponsors: Sponsor[];
  anonymous: {
    activeCount: number;
  };
};

const repositoryRoot = resolve(import.meta.dirname, '..');
const dataPath = resolve(repositoryRoot, 'docs/sponsors.json');
const outputPath = resolve(repositoryRoot, 'SPONSORS.md');
const checkOnly = process.argv.includes('--check');

function fail(message: string): never {
  throw new Error(`赞助人数据无效：${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  field = key,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${field} 必须是非空字符串`);
  }
  return value;
}

function requireNullableString(
  record: Record<string, unknown>,
  key: string,
  field = key,
): string | null {
  const value = record[key];
  if (value !== null && typeof value !== 'string') {
    fail(`${field} 必须是字符串或 null`);
  }
  return value;
}

function validateUrl(value: string | null, field: string): void {
  if (value === null) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`${field} 不是有效 URL`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    fail(`${field} 只能使用 http 或 https`);
  }
}

function validateMonth(value: string, field: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    fail(`${field} 必须使用 YYYY-MM 格式`);
  }
}

function parseSponsorData(value: unknown): SponsorData {
  if (!isRecord(value)) fail('根节点必须是对象');
  if (value.version !== 1) fail('version 必须是 1');

  const updatedAt = requireString(value, 'updatedAt');
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(updatedAt)) {
    fail('updatedAt 必须使用 YYYY-MM-DD 格式');
  }

  const sponsorUrl = requireString(value, 'sponsorUrl');
  validateUrl(sponsorUrl, 'sponsorUrl');

  if (!Array.isArray(value.tiers)) fail('tiers 必须是数组');
  const tierIds = new Set<string>();
  const tierOrders = new Set<number>();
  const tiers = value.tiers.map((item, index): SponsorTier => {
    if (!isRecord(item)) fail(`tiers[${index}] 必须是对象`);
    const id = requireString(item, 'id', `tiers[${index}].id`);
    const name = requireString(item, 'name', `tiers[${index}].name`);
    const description = requireString(
      item,
      'description',
      `tiers[${index}].description`,
    );
    const order = item.order;
    if (!Number.isInteger(order)) fail(`tiers[${index}].order 必须是整数`);
    if (tierIds.has(id)) fail(`tier id 重复：${id}`);
    if (tierOrders.has(order as number)) fail(`tier order 重复：${order}`);
    tierIds.add(id);
    tierOrders.add(order as number);
    return { id, name, description, order: order as number };
  });

  if (!Array.isArray(value.sponsors)) fail('sponsors 必须是数组');
  const sponsorIds = new Set<string>();
  const sponsors = value.sponsors.map((item, index): Sponsor => {
    if (!isRecord(item)) fail(`sponsors[${index}] 必须是对象`);
    const id = requireString(item, 'id', `sponsors[${index}].id`);
    const name = requireString(item, 'name', `sponsors[${index}].name`);
    const kind = item.kind;
    const tier = requireString(item, 'tier', `sponsors[${index}].tier`);
    const since = requireString(item, 'since', `sponsors[${index}].since`);
    const endedAt = requireNullableString(
      item,
      'endedAt',
      `sponsors[${index}].endedAt`,
    );
    const blessing = requireString(
      item,
      'blessing',
      `sponsors[${index}].blessing`,
    );
    const url = requireNullableString(item, 'url', `sponsors[${index}].url`);
    const avatar = requireNullableString(
      item,
      'avatar',
      `sponsors[${index}].avatar`,
    );

    if (kind !== 'person' && kind !== 'organization') {
      fail(`sponsors[${index}].kind 必须是 person 或 organization`);
    }
    if (sponsorIds.has(id)) fail(`sponsor id 重复：${id}`);
    if (!tierIds.has(tier)) fail(`sponsors[${index}].tier 不存在：${tier}`);
    validateMonth(since, `sponsors[${index}].since`);
    if (endedAt !== null) {
      validateMonth(endedAt, `sponsors[${index}].endedAt`);
      if (endedAt < since) fail(`sponsors[${index}].endedAt 不能早于 since`);
    }
    validateUrl(url, `sponsors[${index}].url`);
    validateUrl(avatar, `sponsors[${index}].avatar`);
    sponsorIds.add(id);
    return { id, name, kind, tier, since, endedAt, blessing, url, avatar };
  });

  if (!isRecord(value.anonymous)) fail('anonymous 必须是对象');
  const activeCount = value.anonymous.activeCount;
  if (!Number.isInteger(activeCount) || (activeCount as number) < 0) {
    fail('anonymous.activeCount 必须是非负整数');
  }

  return {
    version: 1,
    updatedAt,
    sponsorUrl,
    tiers,
    sponsors,
    anonymous: { activeCount: activeCount as number },
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()<>#+.!|-])/g, '\\$1');
}

function sponsorLabel(sponsor: Sponsor): string {
  const name = escapeMarkdown(sponsor.name);
  return sponsor.url ? `[${name}](${sponsor.url})` : name;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function sponsorAvatar(sponsor: Sponsor): string {
  if (!sponsor.avatar) return '—';

  const src = escapeHtmlAttribute(sponsor.avatar);
  const alt = escapeHtmlAttribute(`${sponsor.name}的头像`);
  return `<img src="${src}" alt="${alt}" width="48" height="48" />`;
}

function sponsorPeriod(sponsor: Sponsor): string {
  return sponsor.endedAt
    ? `${sponsor.since} 至 ${sponsor.endedAt}`
    : `自 ${sponsor.since}`;
}

function renderSponsorGroups(
  sponsors: Sponsor[],
  tiers: SponsorTier[],
): string[] {
  if (sponsors.length === 0) return ['目前暂无公开记录。'];

  const lines: string[] = [];
  const orderedTiers = [...tiers].sort(
    (left, right) => left.order - right.order,
  );
  for (const tier of orderedTiers) {
    const members = sponsors
      .filter((sponsor) => sponsor.tier === tier.id)
      .sort((left, right) =>
        left.since === right.since
          ? left.id.localeCompare(right.id)
          : left.since.localeCompare(right.since),
      );
    if (members.length === 0) continue;

    lines.push(
      `### ${escapeMarkdown(tier.name)}`,
      '',
      tier.description,
      '',
      '| 头像 | 赞助人 | 贺词 | 支持时间 |',
      '| :-: | --- | --- | --- |',
    );
    for (const sponsor of members) {
      lines.push(
        `| ${sponsorAvatar(sponsor)} | ${sponsorLabel(sponsor)} | ${escapeMarkdown(sponsor.blessing)} | ${sponsorPeriod(sponsor)} |`,
      );
    }
    lines.push('');
  }

  lines.pop();
  return lines;
}

function renderSponsors(data: SponsorData): string {
  const lines = [
    '# 赞助与鸣谢',
    '',
    '感谢每一位帮助《万界道友》持续维护与成长的道友。新的赞助统一通过爱发电进行，既有历史记录继续保留。',
    '',
    '> 本页自动生成，请勿直接编辑。同步爱发电运行 `pnpm run sponsors:sync`；仅更新历史名单时运行 `pnpm run sponsors:render`。',
    '',
    `最后更新：${data.updatedAt}`,
    '',
    '## 爱发电赞助人',
    '',
    `[![爱发电赞助人名单](sponsorkit/sponsors.svg)](${data.sponsorUrl})`,
    '',
    '爱发电记录由 SponsorKit 同步；当前赞助与“此间有名”会按状态自动分组。',
    '',
    '## 此间有名 · 历史赞助',
    '',
    ...renderSponsorGroups(data.sponsors, data.tiers),
  ];

  if (data.anonymous.activeCount > 0) {
    lines.push(
      '',
      `另有 ${data.anonymous.activeCount} 位匿名道友正在支持项目。`,
    );
  }

  lines.push(
    '',
    '## 赞助项目',
    '',
    '如果你愿意帮助项目承担服务器、AI 服务和持续开发成本，请通过爱发电支持。项目不再提供或推荐其他单独打赏渠道。',
    '',
  );

  if (data.sponsorUrl) {
    lines.push(
      `[前往赞助页面](${data.sponsorUrl}) · [了解赞助流程](SPONSORING.md)`,
    );
  } else {
    lines.push('[了解赞助流程](SPONSORING.md)');
  }

  lines.push(
    '',
    '## 展示与隐私',
    '',
    '- 爱发电赞助人按平台提供的公开昵称和头像展示；历史名单只保留既有公开记录。',
    '- 不公开真实姓名、支付账号、订单号、支付记录或赞助金额。',
    '- 同一档位内按开始赞助时间排序，不按金额排名。',
    '- 如需修改或移除公开信息，请联系项目维护者。',
    '',
  );

  return lines.join('\n');
}

const rawData = JSON.parse(await readFile(dataPath, 'utf8'));
const rendered = renderSponsors(parseSponsorData(rawData));

if (checkOnly) {
  const current = await readFile(outputPath, 'utf8');
  if (current !== rendered) {
    fail(
      'SPONSORS.md 与 docs/sponsors.json 不同步，请运行 pnpm run sponsors:render',
    );
  }
  console.log('赞助人数据和 SPONSORS.md 已同步。');
} else {
  await writeFile(outputPath, rendered, 'utf8');
  console.log('已更新 SPONSORS.md。');
}

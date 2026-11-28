import { AvatarGallery } from '@app/components/feature/avatar/AvatarGallery';
import {
  AVATAR_API,
  isAvatarJobPending,
  useAvatarCollection,
  useAvatarEquip,
} from '@app/components/feature/avatar/avatarCollection';
import {
  AvatarArtwork,
  AvatarFrame,
  type CultivatorPortrait,
} from '@app/components/feature/cultivator/CultivatorAvatar';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { AppViewportColor } from '@app/components/layout/AppViewportColor';
import { GameImage } from '@app/components/ui/GameImage';
import { InkButton } from '@app/components/ui/InkButton';
import { InkLoadingBar } from '@app/components/ui/InkLoadingBar';
import { InkNotice } from '@app/components/ui/InkNotice';
import { apiFetch } from '@app/lib/api/fetch';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import {
  AVATAR_DESCRIPTION_LIMIT,
  type AvatarJobView,
} from '@daoyou/contracts/player/avatar';
import {
  AVATAR_TALISMAN_NAME,
  AVATAR_TALISMAN_SCENARIO,
} from '@daoyou/game-content/consumables';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import './portrait-studio.css';
import { portraitKeywords } from './portraitKeywords';

const returnLinks = {
  bag: { href: '/game/inventory', label: '返回储物袋' },
  card: { href: '/game/cultivator?tab=card', label: '返回名片设置' },
  profile: { href: '/game/cultivator', label: '返回人物属性' },
};

const failureMessages = {
  description: '请补充可画出的人物外观，再试一次。',
  moderation: '描述或成图未通过内容审核，请修改描述。',
  generation: '本次未能完成绘制，可以再试一次。',
  storage: '头像暂时无法保存，可以再试一次。',
};

export default function PortraitStudioRoute() {
  const profile = useCultivatorIdentity();
  const [params] = useSearchParams();
  const source = params.get('from');
  const back =
    source === 'bag' || source === 'card'
      ? returnLinks[source]
      : returnLinks.profile;
  const cultivator = profile.data?.cultivator;

  return (
    <div className="portrait-studio">
      <AppViewportColor color="var(--portrait-studio-surface)" />
      <GameImage
        src="/assets/scenes/portrait-studio.webp"
        alt=""
        className="portrait-studio-backdrop"
      />
      {cultivator?.id ? (
        <PortraitStudio
          key={cultivator.id}
          cultivator={{ ...cultivator, id: cultivator.id }}
          back={back}
        />
      ) : (
        <div className="portrait-studio-content">
          <InkButton href={back.href} variant="secondary" className="min-h-11">
            {back.label}
          </InkButton>
          {profile.error ? (
            <InkNotice tone="warning">
              暂时无法读取角色。
              <InkButton onClick={() => void profile.reload()}>重试</InkButton>
            </InkNotice>
          ) : (
            <GameLoadingState variant="inline" message="正在准备画案……" />
          )}
        </div>
      )}
    </div>
  );
}

function PortraitStudio({
  cultivator,
  back,
}: {
  cultivator: CultivatorPortrait & { id: string };
  back: { href: string; label: string };
}) {
  const collection = useAvatarCollection(true);
  const bag = useInventoryBag();
  const { mutate } = useResourceMutation();
  const { equip, equipping, equipError } = useAvatarEquip(cultivator.id);
  const [category, setCategory] =
    useState<keyof typeof portraitKeywords>('气质');
  const [description, setDescription] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reviewLatest, setReviewLatest] = useState(false);
  const [dismissedJob, setDismissedJob] = useState<string>();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const request = useRef<{ signature: string; id: string }>(null);

  const talismans =
    bag.data?.items.filter((item) => {
      if (item.location !== 'bag' || item.definitionId !== 'consumable.v1')
        return false;
      const spec = ConsumableFactsSchema.safeParse(item.instanceData).data
        ?.spec;
      return (
        spec?.kind === 'talisman' && spec.scenario === AVATAR_TALISMAN_SCENARIO
      );
    }) ?? [];
  const available = talismans.reduce((sum, item) => sum + item.quantity, 0);
  const job = collection.view?.latestJob;
  const working = submitting || isAvatarJobPending(job);
  const result =
    !working &&
    job?.status === 'ready' &&
    job.id !== dismissedJob &&
    (reviewLatest || collection.observedJobId === job.id)
      ? job
      : null;
  const draft =
    description ??
    (job?.status === 'failed'
      ? job.description.slice(0, AVATAR_DESCRIPTION_LIMIT)
      : '');
  const pausedForRefund = job?.status === 'failed' && !job.refundLocation;
  const unavailable =
    !collection.view?.generationEnabled ||
    !available ||
    !!bag.error ||
    pausedForRefund;
  const fragments = draft.split('，').map((fragment) => fragment.trim());

  function draftWith(word: string) {
    if (fragments.includes(word))
      return fragments.filter((fragment) => fragment !== word).join('，');
    const text = draft
      .trim()
      .replace(/[，、,]+$/u, '')
      .trimEnd();
    return text ? `${text}，${word}` : word;
  }

  async function draw() {
    const item = talismans[0];
    const text = draft.trim();
    if (
      !item ||
      unavailable ||
      working ||
      text.length < 2 ||
      text.length > AVATAR_DESCRIPTION_LIMIT ||
      request.current?.signature === 'pending'
    )
      return;
    const signature = JSON.stringify([item.id, item.revision, text]);
    const id =
      request.current?.signature === signature
        ? request.current.id
        : crypto.randomUUID();
    request.current = { signature: 'pending', id };
    setSubmitting(true);
    setSubmitError('');
    try {
      const next = await mutate<AvatarJobView>(
        apiFetch(AVATAR_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: id,
            itemId: item.id,
            revision: item.revision,
            description: text,
          }),
        }),
      );
      request.current = null;
      collection.setLatestJob(next);
      setDescription(undefined);
    } catch (error) {
      request.current = { signature, id };
      setSubmitError(
        error instanceof Error ? error.message : '暂时无法提交绘制',
      );
    } finally {
      collection.reload();
      setSubmitting(false);
    }
  }

  return (
    <div className="portrait-studio-content">
      <nav className="portrait-studio-nav" aria-label="画室导航">
        <InkButton variant="secondary" href={back.href} className="min-h-11">
          {back.label}
        </InkButton>
        <InkButton className="min-h-11" onClick={() => setGalleryOpen(true)}>
          头像收藏
        </InkButton>
      </nav>
      <header className="portrait-studio-heading">
        <h1>写影阁</h1>
      </header>
      {!collection.view ? (
        collection.error ? (
          <InkNotice tone="warning">
            {collection.error}
            <InkButton onClick={collection.reload}>重试</InkButton>
          </InkNotice>
        ) : (
          <GameLoadingState variant="inline" message="正在准备画案……" />
        )
      ) : (
        <div
          className="portrait-studio-desk"
          data-phase={result ? 'ready' : working ? 'working' : 'draft'}
        >
          {working || result ? (
            <section
              className="portrait-studio-stage"
              aria-label={result ? '成图预览' : '绘制进度'}
            >
              {result ? (
                <AvatarFrame className="portrait-studio-result">
                  <AvatarArtwork
                    key={result.id}
                    id={result.id}
                    size="1024"
                    alt="新绘制的头像"
                    reveal
                    className="size-full"
                  />
                </AvatarFrame>
              ) : (
                <div
                  className="portrait-studio-working"
                  data-processing={job?.status === 'processing' || undefined}
                  aria-hidden="true"
                >
                  <span />
                </div>
              )}
            </section>
          ) : (
            <div className="portrait-studio-empty" aria-hidden="true" />
          )}
          {working ? (
            <section
              className="portrait-studio-workbench"
              aria-live="polite"
              aria-busy="true"
            >
              <h2 className="portrait-studio-section-title">
                {job?.status === 'processing'
                  ? '正在保存墨像'
                  : job?.status === 'generating'
                    ? '正在绘制墨像'
                    : '正在准备画纸'}
              </h2>
              <InkLoadingBar size="scene" tone="accent" immediate />
              <p className="text-ink-secondary text-sm leading-6">
                {submitting
                  ? '正在提交绘制请求。'
                  : '已暂占 1 枚写影符。可以离开，稍后回来查看。'}
              </p>
              {collection.error ? (
                <p role="status" className="text-ink-secondary text-sm">
                  暂时无法同步，稍后会重新读取进度。
                </p>
              ) : null}
            </section>
          ) : result ? (
            <section className="portrait-studio-workbench">
              <h2 className="portrait-studio-section-title">墨像已入藏</h2>
              <p className="text-ink-secondary text-sm leading-7">
                {result.description}
              </p>
              {equipError ? (
                <p role="alert" className="text-crimson text-sm">
                  {equipError}
                </p>
              ) : null}
              <div className="portrait-studio-actions">
                <InkButton
                  variant="primary"
                  className="portrait-studio-primary min-h-11"
                  disabled={cultivator.avatarId === result.id}
                  pending={equipping}
                  pendingLabel="启用中……"
                  onClick={() => void equip(result.id)}
                >
                  {cultivator.avatarId === result.id
                    ? '当前使用中'
                    : '启用此头像'}
                </InkButton>
                <InkButton
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => {
                    setReviewLatest(false);
                    setDismissedJob(result.id);
                  }}
                >
                  再绘一幅
                </InkButton>
              </div>
            </section>
          ) : (
            <form
              className="portrait-studio-workbench"
              onSubmit={(event) => {
                event.preventDefault();
                void draw();
              }}
            >
              {job?.status === 'failed' ? (
                <InkNotice tone="warning">
                  {failureMessages[job.failure ?? 'generation']}{' '}
                  {job.refundLocation
                    ? `写影符已退至${job.refundLocation === 'bag' ? '储物袋' : '储藏室'}。`
                    : '写影符正在退还。'}
                </InkNotice>
              ) : null}
              <div className="portrait-studio-writing">
                <div className="flex items-end justify-between gap-3">
                  <label
                    className="portrait-studio-section-title"
                    htmlFor="portrait-description"
                  >
                    落笔写形
                  </label>
                  <span className="text-ink-secondary font-mono text-sm">
                    {draft.length} / {AVATAR_DESCRIPTION_LIMIT}
                  </span>
                </div>
                <textarea
                  id="portrait-description"
                  aria-label="人物外观"
                  aria-describedby="portrait-description-hint"
                  rows={3}
                  maxLength={AVATAR_DESCRIPTION_LIMIT}
                  value={draft}
                  onChange={(event) =>
                    setDescription(
                      event.target.value.slice(0, AVATAR_DESCRIPTION_LIMIT),
                    )
                  }
                  placeholder="如：青年女修，乌发束玉，眉眼清冷，着青灰道袍。"
                />
                <p
                  id="portrait-description-hint"
                  className="text-ink-secondary text-xs leading-5"
                >
                  写下一位修士的外貌、衣饰或气质。
                </p>
              </div>
              <section
                className="portrait-studio-inspiration"
                aria-label="笔下灵感"
              >
                <h2 className="text-sm font-semibold">笔下灵感</h2>
                <div
                  className="portrait-studio-categories"
                  aria-label="灵感分类"
                  role="group"
                >
                  {(
                    Object.keys(
                      portraitKeywords,
                    ) as (keyof typeof portraitKeywords)[]
                  ).map((group) => (
                    <button
                      type="button"
                      key={group}
                      aria-pressed={group === category}
                      onClick={() => setCategory(group)}
                    >
                      {group}
                    </button>
                  ))}
                </div>
                <div className="portrait-studio-words">
                  {portraitKeywords[category].map((word) => (
                    <button
                      type="button"
                      key={word}
                      aria-pressed={fragments.includes(word)}
                      disabled={
                        draftWith(word).length > AVATAR_DESCRIPTION_LIMIT
                      }
                      onClick={() => setDescription(draftWith(word))}
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </section>
              <div className="portrait-studio-cost">
                <div className="text-ink-secondary text-sm leading-6">
                  {!collection.view.generationEnabled ? (
                    '绘制暂未开放。'
                  ) : bag.error ? (
                    <>
                      <span>暂时无法读取储物袋。</span>
                      <InkButton onClick={() => void bag.reload()}>
                        重试
                      </InkButton>
                    </>
                  ) : bag.loading && !bag.data ? (
                    '正在读取写影符……'
                  ) : pausedForRefund ? (
                    '写影符退回后可再绘。'
                  ) : available ? (
                    <>
                      成图消耗{' '}
                      <strong className="text-crimson font-mono">1</strong> 枚
                      {AVATAR_TALISMAN_NAME}，失败退还。
                      <span className="block">
                        储物袋可用{' '}
                        <span className="font-mono">{available}</span> 枚
                      </span>
                    </>
                  ) : (
                    `储物袋没有${AVATAR_TALISMAN_NAME}，绘制需 1 枚。`
                  )}
                </div>
                {submitError ? (
                  <p role="alert" className="text-crimson text-sm leading-6">
                    {submitError}
                  </p>
                ) : null}
                <div className="portrait-studio-actions">
                  <InkButton
                    type="submit"
                    className="portrait-studio-primary min-h-11"
                    variant="primary"
                    pending={submitting}
                    disabled={unavailable || draft.trim().length < 2}
                  >
                    落笔绘制
                  </InkButton>
                  {job?.status === 'ready' ? (
                    <InkButton
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => {
                        setDismissedJob(undefined);
                        setReviewLatest(true);
                      }}
                    >
                      查看上次成图
                    </InkButton>
                  ) : null}
                </div>
              </div>
            </form>
          )}
        </div>
      )}
      {galleryOpen ? (
        <AvatarGallery
          cultivator={cultivator}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </div>
  );
}

import { GameIcon } from '@app/components/ui/GameIcon';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import type { ElementType } from '@daoyou/constants/elements';
import type {
  CharacterCard,
  CharacterCardEquipment,
} from '@daoyou/contracts/player/card';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { getElementInfo } from '@daoyou/game-content/presentation/concepts';
import {
  DAO_EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_NAMES,
  type DaoEquipmentInstanceV1,
} from '@daoyou/game-domain/equipment';
import { manualEffectLines } from '@daoyou/game-rules/manuals/presentation';
import { isAdvancedManual } from '@daoyou/game-rules/manuals/projection';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { achievementIcon } from '../achievements/achievementIcons';
import { BeastIcon } from '../beasts/BeastIcon';
import { BeastTradeDetails } from '../beasts/BeastTradePreview';
import { ItemPreviewView } from '../items/ItemPreviewView';
import { ItemSlot, PreviewSlot } from '../items/ItemSlot';
import { equipmentSlotIcons } from '../items/presentation/equipment';
import type { CardPage } from './CharacterCardView';

const trainingIcons: Record<CharacterCard['training'][number]['key'], string> =
  {
    skin: '🛡️',
    sinew_bone: '🦴',
    organs: '🫀',
    qi_blood: '🩸',
    primordial_spirit: '🪷',
    marrow_wash: '💧',
  };

function Section({
  title,
  children,
  count,
}: {
  title: string;
  children: ReactNode;
  count?: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="character-card-section-title">
        <h4>{title}</h4>
        {count != null && (
          <span className="text-ink-secondary font-mono text-xs">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-secondary border-ink/15 border-l-2 px-3 py-2 text-sm">
      {children}
    </p>
  );
}

function AssetFace({
  name,
  icon,
  color,
}: {
  name: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <>
      {icon}
      <span className={`text-xs leading-4 wrap-anywhere ${color}`}>{name}</span>
    </>
  );
}

function EquipmentTile({
  item,
  equipped,
}: {
  item: CharacterCardEquipment;
  equipped?: boolean;
}) {
  return (
    <ItemSlot
      item={{ ...item, equipped }}
      className="character-card-asset"
      customTrigger={{
        label: `预览${item.name}`,
        render: ({ name, icon, color }) => (
          <AssetFace
            name={name}
            color={color}
            icon={
              <GameIcon value={icon} purpose="artwork" className="text-2xl" />
            }
          />
        ),
      }}
    />
  );
}

function Showcase({ card }: { card: CharacterCard }) {
  return (
    <>
      <Section title="展示成就">
        {card.achievements.length ? (
          <ul className="character-card-honors">
            {card.achievements.map((achievement) => (
              <li key={achievement.id}>
                <span className="character-card-medal">
                  <GameIcon value={achievementIcon(achievement)} />
                </span>
                <div className="min-w-0">
                  <p className="font-heading font-semibold wrap-anywhere">
                    {achievement.name}
                  </p>
                  <p className="text-ink-secondary text-xs leading-5 wrap-anywhere">
                    {achievement.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>尚未选择展示成就</Empty>
        )}
      </Section>
      {!!card.equipment.length && (
        <Section title="展示道装">
          <div className="character-card-collection">
            {card.equipment.map((item) => (
              <EquipmentTile key={item.id} item={item} />
            ))}
          </div>
        </Section>
      )}
      {!!card.beasts.length && (
        <Section title="展示灵兽">
          <div className="character-card-collection">
            {card.beasts.map((beast) => (
              <PreviewSlot
                key={beast.id}
                className="character-card-asset"
                customTrigger={{
                  label: `预览${beast.name}`,
                  render: ({ name, color }) => (
                    <AssetFace
                      name={name}
                      color={color}
                      icon={
                        <BeastIcon
                          speciesId={beast.speciesId}
                          isMutant={beast.isMutant}
                          className="text-3xl"
                        />
                      }
                    />
                  ),
                }}
                item={{
                  name: beast.name,
                  quantity: 1,
                  color: 'text-ink',
                  icon: '🐾',
                }}
                renderPreview={() => (
                  <BeastTradeDetails beast={beast} tradeNotice={false} />
                )}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function EquipmentPage({ card }: { card: CharacterCard }) {
  const bySlot = new Map(
    card.equippedEquipment.map((item) => [
      (item.instanceData as DaoEquipmentInstanceV1).slot,
      item,
    ]),
  );
  return (
    <Section
      title="穿戴道装"
      count={bySlot.size + ' / ' + DAO_EQUIPMENT_SLOTS.length}
    >
      <div className="character-card-rack">
        {DAO_EQUIPMENT_SLOTS.map((slot) => {
          const item = bySlot.get(slot);
          return (
            <div key={slot} className="min-w-0">
              <p className="character-card-socket-label">
                {EQUIPMENT_SLOT_NAMES[slot]}
              </p>
              {item ? (
                <EquipmentTile item={item} equipped />
              ) : (
                <div className="character-card-asset character-card-vacant">
                  <GameIcon
                    value={equipmentSlotIcons[slot]}
                    className="text-2xl opacity-35 grayscale"
                  />
                  <span className="text-ink-secondary text-xs">未穿戴</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ManualsPage({ card }: { card: CharacterCard }) {
  return (
    <Section title="装配功法">
      {card.equippedManuals.length ? (
        <div className="character-card-manuals">
          {card.equippedManuals.map((entry) => {
            const manual = CHARACTER_MANUALS_V1.find(
              (m) => m.id === entry.manualId,
            );
            if (!manual)
              return (
                <p key={entry.slot}>
                  {entry.name} · {entry.level}层
                </p>
              );
            const kind = isAdvancedManual(manual) ? '高阶功法' : '基础功法';
            const color = tierColorMap[manual.realm];
            return (
              <PreviewSlot
                key={entry.slot}
                item={{ name: manual.name, color, quantity: 1, icon: '📗' }}
                className="character-card-manual"
                customTrigger={{
                  label: `预览${manual.name}，第${entry.level}层`,
                  render: () => (
                    <>
                      <span className="character-card-book">
                        <GameIcon value="📗" />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="text-ink-secondary block text-xs">
                          {manual.realm} · {kind}
                        </span>
                        <span
                          className={`font-heading block text-base font-semibold wrap-anywhere ${color}`}
                        >
                          {manual.name}
                        </span>
                      </span>
                      <span className="text-ink-secondary whitespace-nowrap">
                        <b className="text-ink mr-0.5 font-mono text-base">
                          {entry.level}
                        </b>
                        层
                      </span>
                      <span aria-hidden="true" className="text-teal text-lg">
                        ›
                      </span>
                    </>
                  ),
                }}
                renderPreview={(close) => (
                  <ItemPreviewView
                    close={close}
                    model={{
                      title: manual.name,
                      titleColor: color,
                      icon: '📗',
                      header: [
                        { kind: 'status', value: `${manual.realm} · ${kind}` },
                      ],
                      sections: [
                        {
                          title: `第${entry.level}层功效`,
                          tone: 'positive',
                          entries: manualEffectLines(manual, entry.level).map(
                            (value) => ({ kind: 'line', value }),
                          ),
                        },
                      ],
                      description: manual.description,
                    }}
                  />
                )}
              />
            );
          })}
        </div>
      ) : (
        <Empty>尚未装配功法</Empty>
      )}
    </Section>
  );
}

function BackgroundStory({ text }: { text: string }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const p = ref.current!;
    const measure = () =>
      setLong(
        p.scrollHeight > parseFloat(getComputedStyle(p).lineHeight) * 3 + 1,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(p);
    return () => observer.disconnect();
  }, [text]);
  return (
    <div className="character-card-story">
      <p
        id={id}
        ref={ref}
        className={`leading-6 wrap-anywhere whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          className="text-teal min-h-11 cursor-pointer text-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收起故事' : '展开全文'}{' '}
          <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        </button>
      )}
    </div>
  );
}

export function CardPageContent({
  card,
  page,
}: {
  card: CharacterCard;
  page: CardPage;
}) {
  switch (page) {
    case '基本':
      return <Showcase card={card} />;
    case '装备':
      return <EquipmentPage card={card} />;
    case '功法':
      return <ManualsPage card={card} />;
    case '炼体':
      return (
        <Section title="肉身与洗髓">
          <dl className="character-card-tracks">
            {card.training.map((track) => (
              <div key={track.key} className="character-card-track">
                <dt>
                  <span className="character-card-sigil">
                    <GameIcon value={trainingIcons[track.key]} />
                  </span>
                  {track.name.replace(/^炼体·/, '')}
                </dt>
                <dd>
                  <strong className="font-mono">{track.level}</strong> 级
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      );
    case '根基':
      return (
        <>
          <Section title="先天灵根">
            {card.spiritualRoots.length ? (
              <dl className="character-card-roots">
                {card.spiritualRoots.map((root) => (
                  <div key={root.element}>
                    <dt>
                      <span className="character-card-sigil">
                        <GameIcon
                          value={
                            getElementInfo(root.element as ElementType).icon ||
                            '✧'
                          }
                        />
                      </span>
                      {root.element}灵根
                    </dt>
                    {root.grade && <dd>{root.grade}</dd>}
                  </div>
                ))}
              </dl>
            ) : (
              <Empty>暂无灵根记录</Empty>
            )}
          </Section>
          <Section title="背景故事">
            {card.background?.trim() ? (
              <BackgroundStory text={card.background} />
            ) : (
              <Empty>身世未录</Empty>
            )}
          </Section>
        </>
      );
  }
}

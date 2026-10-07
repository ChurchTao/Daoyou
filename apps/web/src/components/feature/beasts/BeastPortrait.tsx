import { GameIcon, type GameIconProps } from '@app/components/ui/GameIcon';
import { useId } from 'react';

/**
 * 变异色相角，按物种单独指定，不取色环上最远的石色。
 * 滤镜只转动高饱和彩墨，角度让该物种的主彩墨落到选定石色：
 * 朱砂、赭石、藤黄、石绿、青绿、花青、紫。
 * 近乎纯墨的物种只用很小的角度，避免暖灰被带偏。
 */
const MUTANT_HUE: Record<string, number> = {
  'beast-baize': 140,
  'beast-bifang': -80,
  'beast-diting': 93,
  'beast-fire-crow': -144,
  'beast-lantern-butterfly': -163,
  'beast-golden-crow': 163,
  'beast-huodou': -90,
  'beast-ink-jiao': 40,
  'beast-mimi': -110,
  'beast-mingshe': 126,
  'beast-moon-marten': 36,
  'beast-nether-tiger': 155,
  'beast-nine-tailed-fox': 45,
  'beast-qilin': -111,
  'beast-qingluan': 169,
  'beast-qiongqi': 144,
  'beast-red-tail-scorpion': 153,
  'beast-rock-boar': 24,
  'beast-shen-clam': -175,
  'beast-silverwing-mantis': 28,
  'beast-six-eyed-ape': 40,
  'beast-snake-neck-turtle': 120,
  'beast-snow-crane': 20,
  'beast-spirit-fox': -88,
  'beast-stoneback-bear': 127,
  'beast-taotie': 147,
  'beast-golden-toad': 123,
  'beast-thunder-peng': 133,
  'beast-wind-wolf': 36,
  'beast-xiezhi': 174,
  'beast-xuangui': -115,
  'beast-yinglong': -166,
  'beast-zheng': -91,
  'beast-zhuyan': -85,
};

function mutantHue(value: string) {
  return value.startsWith('icon:') ? MUTANT_HUE[value.slice(5)] : undefined;
}

/** 只转动高饱和彩墨，暖灰墨与透明区域保持原样。 */
function MutantChromaFilter({ id, hue }: { id: string; hue: number }) {
  return (
    <svg
      width="0"
      height="0"
      className="pointer-events-none absolute"
      aria-hidden
    >
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          result="gray"
          values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
        />
        <feBlend
          in="SourceGraphic"
          in2="gray"
          mode="difference"
          result="diff"
        />
        <feColorMatrix
          in="diff"
          result="mask"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  8 8 8 0 -0.7"
        />
        <feColorMatrix
          in="SourceGraphic"
          type="hueRotate"
          values={String(hue)}
          result="shifted"
        />
        <feComposite in="shifted" in2="mask" operator="in" result="color" />
        <feComposite
          in="SourceGraphic"
          in2="mask"
          operator="out"
          result="ink"
        />
        <feMerge result="merged">
          <feMergeNode in="ink" />
          <feMergeNode in="color" />
        </feMerge>
        <feComposite in="merged" in2="SourceGraphic" operator="in" />
      </filter>
    </svg>
  );
}

/** Shared by owned beasts and frozen battle/replay appearances. */
export function BeastPortrait({
  isMutant,
  value,
  className,
  ...props
}: GameIconProps & { isMutant?: boolean }) {
  const hue = isMutant ? mutantHue(value) : undefined;
  const filterId = `beast-mutant-${useId().replace(/:/g, '')}`;
  return (
    <>
      {hue == null ? null : <MutantChromaFilter id={filterId} hue={hue} />}
      <GameIcon
        purpose="artwork"
        {...props}
        value={value}
        className={className}
        style={hue == null ? undefined : { filter: `url(#${filterId})` }}
      />
    </>
  );
}

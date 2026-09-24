import { useGameSettings } from '@app/lib/game-setting';
import type { ComponentProps, CSSProperties } from 'react';

export type GameImagePurpose = 'artwork' | 'interface';

type GameImageProps = ComponentProps<'img'> & {
  purpose?: GameImagePurpose;
};

/** Only artwork follows browser preferences; layout and accessible text stay intact. */
export function GameImage({ purpose = 'artwork', ...props }: GameImageProps) {
  return purpose === 'artwork' ? (
    <ArtworkImage {...props} />
  ) : (
    <img {...props} />
  );
}

function useArtworkStyle(style?: CSSProperties): CSSProperties {
  const { imageOpacity } = useGameSettings();
  return {
    ...style,
    opacity: `calc(${style?.opacity ?? 1} * ${imageOpacity})`,
  };
}

function ArtworkImage({ style, ...props }: ComponentProps<'img'>) {
  const artworkStyle = useArtworkStyle(style);
  return <img {...props} style={artworkStyle} />;
}

/** Artwork represented by emoji or inline SVG shares the same opacity policy. */
export function GameArtwork({ style, ...props }: ComponentProps<'span'>) {
  const artworkStyle = useArtworkStyle(style);
  return <span {...props} style={artworkStyle} />;
}

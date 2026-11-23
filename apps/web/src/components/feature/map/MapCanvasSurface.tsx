import type { RefObject } from 'react';

export function MapCanvasSurface({
  root,
  image,
}: {
  root: RefObject<HTMLDivElement | null>;
  image?: string;
}) {
  return (
    <>
      {image ? (
        <img
          src={image}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full object-cover"
        />
      ) : null}
      <div
        ref={root}
        className="absolute inset-0 overflow-hidden [&>canvas]:block [&>canvas]:h-full! [&>canvas]:w-full!"
      />
    </>
  );
}

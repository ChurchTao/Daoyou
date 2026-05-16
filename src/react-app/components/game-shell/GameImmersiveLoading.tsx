export function GameImmersiveLoading({
  message = '天机流转中……',
}: {
  message?: string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-20">
      <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] min-w-[220px] border border-dashed px-5 py-4 text-center">
        <p className="loading-tip">{message}</p>
      </div>
    </div>
  );
}

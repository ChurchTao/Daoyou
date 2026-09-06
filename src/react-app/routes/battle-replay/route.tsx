import { Link } from 'react-router';

export default function RetiredBattleSharePage() {
  return (
    <main className="bg-paper text-ink flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-sm">
      <p>旧版战绩分享已停止查看。</p>
      <Link className="underline" to="/game/battle/history">
        前往新版战绩
      </Link>
    </main>
  );
}

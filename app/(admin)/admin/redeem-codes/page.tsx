import { RedeemCodesTable } from './_components/RedeemCodesTable';

export default function RedeemCodesPage() {
  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          REDEEM CODES
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">兑换码管理</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          管理兑换码状态、名额与生效时间，奖励通过游戏内邮件发放。
        </p>
      </header>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <RedeemCodesTable />
      </section>
    </div>
  );
}

import { EmailBroadcastForm } from './EmailBroadcastForm';

export default function AdminEmailBroadcastPage() {
  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <p className="text-xs tracking-[0.2em] text-ink-secondary">BROADCAST</p>
        <h2 className="mt-2 font-heading text-4xl text-ink">邮箱群发</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          面向已认证邮箱用户同步群发，支持模板、基础筛选与 dry run 预估。
        </p>
      </header>

      <section className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <EmailBroadcastForm />
      </section>
    </div>
  );
}

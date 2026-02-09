import { EmailBroadcastForm } from './EmailBroadcastForm';

export default function AdminEmailBroadcastPage() {
  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <p className="text-xs tracking-[0.2em] text-ink-secondary">BROADCAST</p>
        <h2 className="mt-2 font-heading text-4xl text-ink">邮箱群发</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          面向已认证邮箱用户批量发送运营通知，支持 dry run 预览人数。
        </p>
      </header>

      <section className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <EmailBroadcastForm />
      </section>
    </div>
  );
}

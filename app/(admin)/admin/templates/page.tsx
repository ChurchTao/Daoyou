import { TemplatesTable } from './_components/TemplatesTable';

export default function TemplatesPage() {
  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <p className="text-xs tracking-[0.2em] text-ink-secondary">TEMPLATES</p>
        <h2 className="mt-2 font-heading text-4xl text-ink">模板中心</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          管理 email / game_mail 模板，支持变量占位符 `{'{{varName}}'}`。
        </p>
      </header>

      <section className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <TemplatesTable />
      </section>
    </div>
  );
}

import { TemplatesTable } from './_components/TemplatesTable';

export default function TemplatesPage() {
  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">TEMPLATES</p>
        <h2 className="font-heading text-ink mt-2 text-4xl">模板中心</h2>
        <p className="text-ink-secondary mt-2 text-sm">
          管理 email / game_mail 模板，支持变量占位符 `{'{{varName}}'}`。
        </p>
      </header>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <TemplatesTable />
      </section>
    </div>
  );
}

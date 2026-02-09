import { TemplateEditorForm } from '../_components/TemplateEditorForm';

export default function NewTemplatePage() {
  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <p className="text-xs tracking-[0.2em] text-ink-secondary">NEW TEMPLATE</p>
        <h2 className="mt-2 font-heading text-4xl text-ink">新建模板</h2>
      </header>

      <section className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <TemplateEditorForm mode="create" />
      </section>
    </div>
  );
}

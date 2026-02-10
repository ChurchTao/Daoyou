import { TemplateEditorForm } from '../_components/TemplateEditorForm';

export default function NewTemplatePage() {
  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          NEW TEMPLATE
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">新建模板</h2>
      </header>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <TemplateEditorForm mode="create" />
      </section>
    </div>
  );
}

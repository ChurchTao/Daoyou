import { EditTemplateClient } from './EditTemplateClient';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <p className="text-xs tracking-[0.2em] text-ink-secondary">EDIT TEMPLATE</p>
        <h2 className="mt-2 font-heading text-4xl text-ink">编辑模板</h2>
      </header>

      <section className="rounded-xl border border-ink/15 bg-paper/90 p-6">
        <EditTemplateClient id={id} />
      </section>
    </div>
  );
}

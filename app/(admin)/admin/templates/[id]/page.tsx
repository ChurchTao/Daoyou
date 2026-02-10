import { EditTemplateClient } from './EditTemplateClient';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-5">
      <header className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          EDIT TEMPLATE
        </p>
        <h2 className="font-heading text-ink mt-2 text-4xl">编辑模板</h2>
      </header>

      <section className="border-ink/15 bg-paper/90 rounded-xl border p-6">
        <EditTemplateClient id={id} />
      </section>
    </div>
  );
}

import { TemplateCard } from './template-card';

type Template = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; email: string };
  labels: { label: { id: string; name: string; color: string } }[];
  subtasks: { id: string; title: string; order: number }[];
  _count: { subtasks: number; labels: number };
};

type TemplateListProps = {
  templates: Template[];
};

export function TemplateList({ templates }: TemplateListProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid="template-list"
    >
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}

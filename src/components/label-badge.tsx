import { cn } from '@/lib/utils';

export type LabelBadgeProps = {
  name: string;
  color: string;
  className?: string;
};

export function getContrastColor(hexColor: string): string {
  const r = Number.parseInt(hexColor.slice(1, 3), 16);
  const g = Number.parseInt(hexColor.slice(3, 5), 16);
  const b = Number.parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function LabelBadge({ name, color, className }: LabelBadgeProps) {
  const textColor = getContrastColor(color);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: color, color: textColor }}
    >
      {name}
    </span>
  );
}

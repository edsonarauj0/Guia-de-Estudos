/**
 * SubjectSelect — wrapper do Select do shadcn/ui (base-ui v4)
 * Usa a prop `label` do SelectItem para exibir o nome correto no trigger.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Subject } from '@/types';

interface SubjectSelectProps {
  subjects: Subject[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SubjectSelect({
  subjects,
  value,
  onChange,
  placeholder = 'Selecione a matéria...',
  className,
}: SubjectSelectProps) {
  // Encontra o nome da matéria selecionada para exibir no trigger
  const selected = subjects.find((s) => s.id === value);

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v ?? '')}
    >
      <SelectTrigger className={className ?? 'w-full'}>
        {selected ? (
          <span className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: selected.color }}
            />
            {selected.name}
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {subjects.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            Nenhuma matéria cadastrada
          </div>
        ) : (
          subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

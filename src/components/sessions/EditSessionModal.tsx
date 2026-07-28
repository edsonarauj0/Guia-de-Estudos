import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, HelpCircle, Loader2, RotateCcw, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { updateSession, deleteSession } from '@/lib/firestore';
import type { SessionType, StudySession } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SESSION_TYPES: Array<{
  value: SessionType;
  label: string;
  icon: typeof Video;
  className: string;
}> = [
  { value: 'video', label: 'Videoaulas', icon: Video, className: 'text-sky-500' },
  { value: 'pdf', label: 'PDF / Livro', icon: FileText, className: 'text-emerald-500' },
  { value: 'questions', label: 'Questões', icon: HelpCircle, className: 'text-amber-500' },
  { value: 'revision', label: 'Revisões', icon: RotateCcw, className: 'text-rose-500' },
];

interface Props {
  session: StudySession | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export default function EditSessionModal({ session, open, onClose, onSaved, onDeleted }: Props) {
  const [type, setType] = useState<SessionType>('video');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(1);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoStartedAt, setVideoStartedAt] = useState('');
  const [videoEndedAt, setVideoEndedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session) return;
    const started = parseISO(session.startedAt);
    setType(session.type);
    setDate(format(started, 'yyyy-MM-dd'));
    setStartTime(format(started, 'HH:mm'));
    setDurationMinutes(session.durationMinutes);
    setVideoTitle(session.videoTitle ?? '');
    setVideoStartedAt(session.videoStartedAt ?? '');
    setVideoEndedAt(session.videoEndedAt ?? '');
    setConfirmDelete(false);
  }, [session]);

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const startedAt = new Date(`${date}T${startTime}:00`).toISOString();
      const endedAt = new Date(
        new Date(`${date}T${startTime}:00`).getTime() + durationMinutes * 60 * 1000
      ).toISOString();

      const payload: Partial<Omit<StudySession, 'id'>> = {
        type,
        startedAt,
        endedAt,
        durationMinutes,
        videoTitle: type === 'video' ? (videoTitle || undefined) : undefined,
        videoStartedAt: type === 'video' ? (videoStartedAt || undefined) : undefined,
        videoEndedAt: type === 'video' ? (videoEndedAt || undefined) : undefined,
      };

      await updateSession(session.id, payload);
      toast.success('Registro atualizado!');
      onSaved();
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteSession(session.id);
      toast.success('Registro excluido!');
      onDeleted();
    } catch {
      toast.error('Erro ao excluir. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-sm border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {session.topicName ?? session.subjectName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{session.subjectName}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de estudo</Label>
            <Select value={type} onValueChange={(v) => setType(v as SessionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora de inicio</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Duracao (minutos)</Label>
            <Input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
            />
          </div>

          {type === 'video' && (
            <div className="space-y-3 rounded-sm border border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dados do video
              </p>
              <div className="space-y-1.5">
                <Label>Titulo do video</Label>
                <Input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Ex: Aula 01 - Introducao"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Inicio no video</Label>
                  <Input
                    value={videoStartedAt}
                    onChange={(e) => setVideoStartedAt(e.target.value)}
                    placeholder="00:00:00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim no video</Label>
                  <Input
                    value={videoEndedAt}
                    onChange={(e) => setVideoEndedAt(e.target.value)}
                    placeholder="00:00:00"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant={confirmDelete ? 'destructive' : 'outline'}
            onClick={handleDelete}
            disabled={deleting || saving}
            className="gap-2"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {confirmDelete ? 'Confirmar exclusao' : 'Excluir'}
          </Button>

          <div className="flex gap-2">
            {confirmDelete && (
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancelar
              </Button>
            )}
            {!confirmDelete && (
              <>
                <Button variant="ghost" onClick={handleClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

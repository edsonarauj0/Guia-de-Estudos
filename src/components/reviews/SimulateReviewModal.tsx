import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { FlaskConical, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { updateReviewCard } from "@/lib/firestore";
import { calculateSM2, describeInterval, formatDateYMD, getQualityLabel } from "@/lib/sm2";
import type { SM2Quality } from "@/lib/sm2";
import type { ReviewCard } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PREVIEW_QUALITIES: SM2Quality[] = [0, 2, 4, 5];

interface Props {
  card: ReviewCard | null;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export default function SimulateReviewModal({ card, open, onClose, onApplied }: Props) {
  const [nextReview, setNextReview] = useState("");
  const [interval, setInterval] = useState(1);
  const [repetitions, setRepetitions] = useState(0);
  const [easeFactor, setEaseFactor] = useState(2.5);
  const [lastReview, setLastReview] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!card) return;
    setNextReview(card.nextReview);
    setInterval(card.interval);
    setRepetitions(card.repetitions);
    setEaseFactor(Number(card.easeFactor.toFixed(2)));
    setLastReview(card.lastReview ?? "");
  }, [card]);

  const simulatedCard = useMemo(
    () => ({
      repetitions,
      interval,
      easeFactor,
      nextReview,
      lastReview: lastReview || undefined,
    }),
    [repetitions, interval, easeFactor, nextReview, lastReview]
  );

  const previews = useMemo(
    () =>
      PREVIEW_QUALITIES.map((q) => {
        const result = calculateSM2(simulatedCard, q);
        const { label, color } = getQualityLabel(q);
        return { quality: q, label, color, nextInterval: describeInterval(result.interval), nextReview: result.nextReview };
      }),
    [simulatedCard]
  );

  const handleApply = async () => {
    if (!card) return;
    setSaving(true);
    try {
      await updateReviewCard(card.id, {
        nextReview,
        interval,
        repetitions,
        easeFactor,
        lastReview: lastReview || undefined,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Card atualizado!");
      onApplied();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!card) return;
    setResetting(true);
    try {
      const tomorrow = formatDateYMD(addDays(new Date(), 1));
      await updateReviewCard(card.id, {
        nextReview: tomorrow,
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5,
        lastReview: undefined,
        lastQuality: undefined,
        updatedAt: new Date().toISOString(),
      });
      setNextReview(tomorrow);
      setInterval(1);
      setRepetitions(0);
      setEaseFactor(2.5);
      setLastReview("");
      toast.success("Card resetado para o estado inicial!");
      onApplied();
    } catch {
      toast.error("Erro ao resetar. Tente novamente.");
    } finally {
      setResetting(false);
    }
  };

  if (!card) return null;

  const isDue = nextReview <= formatDateYMD(new Date());

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-sm bg-primary/15 text-primary">
              <FlaskConical className="size-4" />
            </div>
            <DialogTitle>Simular histórico de revisão</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Card info */}
          <div className="flex items-center gap-3 rounded-sm border border-border bg-muted/40 px-4 py-3">
            <div className="h-10 w-1 shrink-0 rounded-sm" style={{ backgroundColor: card.subjectColor }} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{card.topicName}</p>
              <p className="truncate text-xs text-muted-foreground">{card.subjectName}</p>
            </div>
            {isDue ? (
              <Badge variant="destructive" className="ml-auto shrink-0">
                {nextReview < formatDateYMD(new Date()) ? "Atrasado" : "Hoje"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto shrink-0">
                {describeInterval(interval)}
              </Badge>
            )}
          </div>

          {/* Campos SM-2 */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Parâmetros SM-2
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Próxima revisão</Label>
                <Input
                  type="date"
                  value={nextReview}
                  onChange={(e) => setNextReview(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Última revisão</Label>
                <Input
                  type="date"
                  value={lastReview}
                  onChange={(e) => setLastReview(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Repetições com sucesso</Label>
                <Input
                  type="number"
                  min={0}
                  value={repetitions}
                  onChange={(e) => setRepetitions(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Intervalo atual (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setInterval(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>
                  Fator de facilidade{" "}
                  <span className="font-normal text-muted-foreground">(mín 1.3 · padrão 2.5)</span>
                </Label>
                <Input
                  type="number"
                  min={1.3}
                  max={5}
                  step={0.1}
                  value={easeFactor}
                  onChange={(e) => setEaseFactor(Math.max(1.3, Number(Number(e.target.value).toFixed(2))))}
                />
              </div>
            </div>
          </div>

          {/* Preview em tempo real */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview — próxima revisão se você avaliar agora com estes valores
            </p>
            <div className="grid grid-cols-2 gap-2">
              {previews.map(({ quality, label, color, nextInterval, nextReview: previewDate }) => (
                <div
                  key={quality}
                  className={`flex flex-col gap-0.5 rounded-sm border px-3 py-2.5 ${color}`}
                >
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="text-xs opacity-80">{nextInterval}</span>
                  <span className="text-[11px] opacity-60">{previewDate}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving || resetting}
            className="gap-2"
          >
            {resetting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Resetar card
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving || resetting}>
              Cancelar
            </Button>
            <Button onClick={handleApply} disabled={saving || resetting} className="gap-2">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Aplicar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

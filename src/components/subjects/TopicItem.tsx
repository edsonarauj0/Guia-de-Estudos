import { useState } from 'react';
import type { Topic } from '@/types';
import { cn } from '@/lib/utils';
import { MEDIA_LABELS, STATUS_LABELS, DIFFICULTY_LABELS, getTopicProgressPercent } from '@/lib/helpers';
import { updateTopic } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Play, FileText, HelpCircle, RotateCcw,
  ChevronDown, ChevronUp, Pencil, Trash2, Tag
} from 'lucide-react';

interface TopicItemProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (topicId: string) => void;
  onUpdate: (updated: Topic) => void;
  inReviewQueue?: boolean;
  onAddToReviewQueue?: (topic: Topic) => void;
}

const MEDIA_ICONS = {
  video: Play,
  pdf: FileText,
  questions: HelpCircle,
  revision: RotateCcw,
};

const STATUS_CYCLE = ['not_started', 'in_progress', 'completed'] as const;

export default function TopicItem({ topic, onEdit, onDelete, onUpdate, inReviewQueue, onAddToReviewQueue }: TopicItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const progress = getTopicProgressPercent(topic.progress);

  const cycleStatus = async (mediaType: keyof typeof topic.progress) => {
    setUpdating(mediaType);
    const current = topic.progress[mediaType].status;
    const idx = STATUS_CYCLE.indexOf(current as any);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const now = new Date().toISOString();

    const updatedMediaProgress = {
      ...topic.progress[mediaType],
      status: next,
    };

    // Firestore rejects undefined values, including inside nested objects.
    delete updatedMediaProgress.completedAt;
    if (next === 'completed') updatedMediaProgress.completedAt = now;

    const updatedProgress = {
      ...topic.progress,
      [mediaType]: updatedMediaProgress,
    };

    const updatedTopic = { ...topic, progress: updatedProgress, updatedAt: now };

    try {
      await updateTopic(topic.planId, topic.subjectId, topic.id, { progress: updatedProgress });
      onUpdate(updatedTopic);
    } catch (error) {
      console.error('Erro ao atualizar o progresso do tópico', error);
      toast.error('Não foi possível atualizar o status');
    } finally {
      setUpdating(null);
    }
  };

  const difficultyColor: Record<string, string> = {
    easy: 'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    hard: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className={cn(
      "bg-background/60 rounded-xl border border-border/60 transition-all duration-200",
      "hover:border-border",
      expanded && "border-primary/20"
    )}>
      {/* Topic header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Progress ring */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="3"
              strokeDasharray={`${progress} ${100 - progress}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
            {progress}%
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground text-sm">{topic.name}</h3>
            {topic.difficulty && (
              <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', difficultyColor[topic.difficulty])}>
                {DIFFICULTY_LABELS[topic.difficulty]}
              </span>
            )}
            {inReviewQueue && (
              <span className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1" title="Na fila de revisão">
                <RotateCcw className="w-3 h-3" />
                Revisão
              </span>
            )}
          </div>

          {/* Media status indicators */}
          <div className="flex items-center gap-2 mt-1.5">
            {(Object.keys(MEDIA_ICONS) as Array<keyof typeof MEDIA_ICONS>).map(type => {
              const Icon = MEDIA_ICONS[type];
              const status = topic.progress[type].status;
              return (
                <div
                  key={type}
                  className={cn(
                    'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md border',
                    status === 'completed' && 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                    status === 'in_progress' && 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                    status === 'not_started' && 'bg-muted/50 text-muted-foreground border-transparent',
                  )}
                  title={`${MEDIA_LABELS[type]}: ${STATUS_LABELS[status]}`}
                >
                  <Icon className="w-3 h-3" />
                </div>
              );
            })}

            {topic.tags && topic.tags.length > 0 && (
              <div className="flex items-center gap-1 ml-1">
                <Tag className="w-3 h-3 text-muted-foreground" />
                {topic.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-xs text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-foreground"
            onClick={e => { e.stopPropagation(); onEdit(topic); }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-destructive"
            onClick={e => { e.stopPropagation(); onDelete(topic.id); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded: media controls */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Clique para alternar o status</p>
            {onAddToReviewQueue && !inReviewQueue && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => onAddToReviewQueue(topic)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Adicionar à revisão
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MEDIA_ICONS) as Array<keyof typeof MEDIA_ICONS>).map(type => {
              const Icon = MEDIA_ICONS[type];
              const status = topic.progress[type].status;
              const isUpdating = updating === type;

              return (
                <button
                  key={type}
                  onClick={() => cycleStatus(type)}
                  disabled={isUpdating}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    status === 'completed' && 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
                    status === 'in_progress' && 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                    status === 'not_started' && 'bg-muted/30 border-border text-muted-foreground hover:text-foreground',
                    isUpdating && 'opacity-50 cursor-wait',
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{MEDIA_LABELS[type]}</p>
                    <p className="text-xs opacity-70">{STATUS_LABELS[status]}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {topic.notes && (
            <div className="bg-muted/20 rounded-lg p-3 text-sm text-muted-foreground">
              {topic.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

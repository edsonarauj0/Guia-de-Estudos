import { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getStudyPlans, updateStudyPlan, setUserProfile } from '@/lib/firestore';
import type { StudyPlan, WeeklyGoal } from '@/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Check, User, Palette, FolderOpen, Lock, Moon, Sun, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const DAY_LABELS: { key: keyof WeeklyGoal; label: string; short: string }[] = [
  { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
];

export default function SettingsPage() {
  const { user, profile } = useAuthContext();
  const { theme, toggleTheme } = useTheme();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [dailyGoalQuestions, setDailyGoalQuestions] = useState(profile?.dailyGoalQuestions ?? 50);
  
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getStudyPlans(user.uid).then(setPlans);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await setUserProfile(user.uid, {
        displayName,
        dailyGoalQuestions
      });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePlanHours = (planId: string, key: keyof WeeklyGoal, value: string) => {
    const num = Math.max(0, Math.min(24, parseFloat(value) || 0));
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        return { ...p, dailyGoalHours: { ...p.dailyGoalHours, [key]: num } };
      }
      return p;
    }));
  };

  const handleSavePlanHours = async (plan: StudyPlan) => {
    setSavingPlanId(plan.id);
    try {
      await updateStudyPlan(plan.id, { dailyGoalHours: plan.dailyGoalHours });
      // Show some temporary success state if needed
    } finally {
      setSavingPlanId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie seu perfil, preferências e planejamentos</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-2" /> Perfil</TabsTrigger>
          <TabsTrigger value="preferences"><Palette className="w-4 h-4 mr-2" /> Preferências</TabsTrigger>
          <TabsTrigger value="plans"><FolderOpen className="w-4 h-4 mr-2" /> Planos</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <div className="glass rounded-sm p-6 space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-sm bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-4xl font-bold text-white flex-shrink-0 shadow-lg">
                {displayName?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Seu Perfil</h2>
                <p className="text-sm text-muted-foreground">Atualize suas informações pessoais.</p>
              </div>
            </div>

            <div className="grid gap-4 max-w-md">
              <div className="space-y-2">
                <Label>Nome de Exibição</Label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile?.email ?? ''} readOnly disabled className="bg-muted" />
              </div>
              <div className="space-y-2 pt-2">
                <Button variant="outline" className="w-full justify-start">
                  <Lock className="w-4 h-4 mr-2" /> Alterar Senha
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="font-semibold mb-4">Metas Globais</h3>
              <div className="space-y-2 max-w-md">
                <Label>Meta diária de questões</Label>
                <Input
                  type="number"
                  min="0"
                  value={dailyGoalQuestions}
                  onChange={e => setDailyGoalQuestions(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className={cn('w-full max-w-md', savedProfile && 'bg-emerald-600 hover:bg-emerald-500')}
            >
              {savedProfile ? (
                <><Check className="w-4 h-4 mr-2" /> Salvo!</>
              ) : savingProfile ? (
                'Salvando...'
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Salvar Perfil</>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6 space-y-6">
          <div className="glass rounded-sm p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <Label className="text-base font-semibold">Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">Altere o tema visual do aplicativo.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-muted-foreground" />
                  <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                  <Moon className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label className="text-base font-semibold text-destructive">Limpar Dados Locais</Label>
                  <p className="text-sm text-muted-foreground">Remove caches de sessão do navegador.</p>
                </div>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" /> Limpar Dados
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="mt-6 space-y-6">
          {plans.map(plan => {
            const totalHours = Object.values(plan.dailyGoalHours || {}).reduce((a, b) => a + (b || 0), 0);
            return (
              <div key={plan.id} className="glass rounded-sm p-6 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: plan.color }} />
                
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {plan.name}
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-sm font-medium border",
                        plan.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        plan.status === 'paused' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-muted text-muted-foreground border-border"
                      )}>
                        {plan.status === 'active' ? 'Ativo' : plan.status === 'paused' ? 'Pausado' : 'Arquivado'}
                      </span>
                    </h3>
                    {plan.examDate && (
                      <p className="text-sm text-muted-foreground mt-1">Data da prova: {new Date(plan.examDate).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                  <Link to="/plans" className="inline-flex items-center justify-center rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3">
                    Gerenciar Planos
                  </Link>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Horas de Estudo</h4>
                    <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-sm">
                      {totalHours}h/semana
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {DAY_LABELS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground w-32 flex-shrink-0">{label}</span>
                        <div className="flex-1 flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="12"
                            step="0.5"
                            value={plan.dailyGoalHours?.[key] || 0}
                            onChange={e => handleUpdatePlanHours(plan.id, key, e.target.value)}
                            className="flex-1 h-2 bg-muted rounded-sm appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary"
                          />
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max="24"
                              step="0.5"
                              value={plan.dailyGoalHours?.[key] || 0}
                              onChange={e => handleUpdatePlanHours(plan.id, key, e.target.value)}
                              className="w-16 text-center pr-6 h-8"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => handleSavePlanHours(plan)}
                    disabled={savingPlanId === plan.id}
                    className="mt-4"
                  >
                    {savingPlanId === plan.id ? 'Salvando...' : 'Salvar Horas'}
                  </Button>
                </div>
              </div>
            );
          })}

          {plans.length === 0 && (
            <div className="text-center py-10 glass rounded-sm border-dashed">
              <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum planejamento encontrado.</p>
              <Link to="/plans" className="inline-flex items-center justify-center rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                Criar Novo Plano
              </Link>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

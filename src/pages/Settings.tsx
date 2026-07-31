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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    } finally {
      setSavingPlanId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-10">
      <div>
        <p className="text-muted-foreground text-sm mb-1">Configurações &gt; Editar Perfil</p>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações pessoais e preferências</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          
          {/* Menu Lateral Estilizado */}
          <div className="md:col-span-1">
            <TabsList className="flex flex-col w-full h-auto bg-transparent p-0 space-y-1">
              <TabsTrigger 
                value="profile" 
                className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-sm text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
              >
                <User className="w-4 h-4" /> 
                <span>Perfil</span>
              </TabsTrigger>
              <TabsTrigger 
                value="preferences" 
                className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-sm text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Palette className="w-4 h-4" /> 
                <span>Preferências</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plans" 
                className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-sm text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors"
              >
                <FolderOpen className="w-4 h-4" /> 
                <span>Planos</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Conteúdo das Abas */}
          <div className="md:col-span-3">
            <TabsContent value="profile" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Perfil</CardTitle>
                  <CardDescription>Atualize suas informações pessoais e metas globais.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-3xl font-bold text-white flex-shrink-0 shadow-lg">
                      {displayName?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Nome de Exibição</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={profile?.email ?? ''} readOnly disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2 pt-2">
                      <Button variant="outline" className="w-fit">
                        <Lock className="w-4 h-4 mr-2" /> Alterar Senha
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h3 className="font-semibold mb-4 text-foreground">Metas Globais</h3>
                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="dailyQuestions">Meta diária de questões</Label>
                      <Input
                        id="dailyQuestions"
                        type="number"
                        min="0"
                        value={dailyGoalQuestions}
                        onChange={e => setDailyGoalQuestions(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="outline">Cancelar</Button>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className={cn(savedProfile && 'bg-emerald-600 hover:bg-emerald-500')}
                    >
                      {savedProfile ? (
                        <><Check className="w-4 h-4 mr-2" /> Salvo!</>
                      ) : savingProfile ? (
                        'Salvando...'
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Salvar alterações</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Preferências do Sistema</CardTitle>
                  <CardDescription>Personalize a sua experiência visual e gerencie dados locais.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plans" className="mt-0 space-y-6">
              {plans.map(plan => {
                const totalHours = Object.values(plan.dailyGoalHours || {}).reduce((a, b) => a + (b || 0), 0);
                return (
                  <Card key={plan.id} className="relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: plan.color }} />
                    
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl flex items-center gap-2">
                            {plan.name}
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-sm font-medium border",
                              plan.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                              plan.status === 'paused' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                              "bg-muted text-muted-foreground border-border"
                            )}>
                              {plan.status === 'active' ? 'Ativo' : plan.status === 'paused' ? 'Pausado' : 'Arquivado'}
                            </span>
                          </CardTitle>
                          {plan.examDate && (
                            <CardDescription className="mt-1">
                              Data da prova: {new Date(plan.examDate).toLocaleDateString('pt-BR')}
                            </CardDescription>
                          )}
                        </div>
                        <Button variant="outline" size="sm">
                          <Link to="/plans">Gerenciar Planos</Link>
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-0">
                      <div className="flex items-center justify-between mb-2 border-t border-border pt-4">
                        <h4 className="font-semibold text-foreground">Horas de Estudo</h4>
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
                                className="flex-1 h-2 bg-muted rounded-sm appearance-none cursor-pointer accent-primary"
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
                    </CardContent>
                  </Card>
                );
              })}

              {plans.length === 0 && (
                <Card className="text-center py-10 border-dashed">
                  <CardContent className="space-y-4 pt-6">
                    <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum planejamento encontrado.</p>
                    <Button>
                      <Link to="/plans">Criar Novo Plano</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>

        </div>
      </Tabs>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getReviewCards } from '@/lib/firestore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, BarChart3, PieChart, History,
  Settings, LogOut, Menu, X, ChevronRight, Moon, Sun,
  FolderOpen, HelpCircle, RotateCcw, LineChart, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlanContext } from '@/contexts/PlanContext';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select';

export default function Sidebar() {
  const { user, profile, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { plans, selectedPlanId, selectPlan } = usePlanContext();
  const [isOpen, setIsOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const cards = await getReviewCards(user.uid);
        const today = new Date().toISOString().slice(0, 10);
        const pending = cards.filter(c => c.nextReview <= today).length;
        setReviewCount(pending);
      } catch (err) {
        console.error('Failed to load review count', err);
      }
    })();
  }, [user]);

  const NAV_ITEMS = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/plans', icon: FolderOpen, label: 'Planejamentos' },
    { to: '/subjects', icon: BookOpen, label: 'Matérias' },
    { to: '/cycle', icon: PieChart, label: 'Ciclo de estudos' },
    { to: '/calendar', icon: CalendarDays, label: 'Calendário' },
    { to: '/sessions', icon: History, label: 'Histórico' },
    { to: '/questions', icon: HelpCircle, label: 'Questões' },
    { to: '/reviews', icon: RotateCcw, label: 'Revisões', badge: reviewCount },
    { to: '/statistics', icon: LineChart, label: 'Estatísticas' },
    { to: '/exams', icon: BarChart3, label: 'Simulados' },
    { to: '/settings', icon: Settings, label: 'Configurações' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-sm bg-card border border-border shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-64 z-50 bg-card border-r border-border flex flex-col",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-foreground">Guia de Estudo</h1>
              <p className="text-xs text-muted-foreground">Tracker de Concursos</p>
            </div>
          </div>
          {plans.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Planejamento ativo</p>
              <Select value={selectedPlanId} onValueChange={value => value && selectPlan(value)}>
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue placeholder="Selecione um plano">
                    {(value: string) => plans.find(p => p.id === value)?.name ?? "Selecione um plano"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Planos</SelectLabel>
                    {plans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn('nav-item group flex items-center', isActive && 'active')
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 ml-2">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm mr-2">
                  {badge}
                </span>
              )}
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-border">
          {/* Removed examName rendering since it's now per-plan */}

          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {profile?.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{profile?.displayName ?? 'Usuário'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-sm mb-1',
              'text-sm font-medium transition-all duration-200',
              'text-muted-foreground hover:text-foreground hover:bg-secondary',
              'group'
            )}
            aria-label="Alternar tema"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'relative w-4 h-4 transition-transform duration-500',
                theme === 'light' ? 'rotate-0' : 'rotate-180'
              )}>
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 absolute inset-0 transition-all duration-300" />
                ) : (
                  <Sun className="w-4 h-4 absolute inset-0 transition-all duration-300 text-amber-400" />
                )}
              </div>
              <span>{theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
            </div>
            {/* Toggle pill */}
            <div className={cn(
              'relative w-10 h-5 rounded-sm border transition-all duration-300 flex-shrink-0',
              theme === 'dark'
                ? 'bg-primary/20 border-primary/40'
                : 'bg-amber-400/20 border-amber-400/40'
            )}>
              <div className={cn(
                'absolute top-0.5 w-4 h-4 rounded-sm transition-all duration-300 shadow-sm',
                theme === 'dark'
                  ? 'left-0.5 bg-primary'
                  : 'left-5 bg-amber-400'
              )} />
            </div>
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </aside>
    </>
  );
}

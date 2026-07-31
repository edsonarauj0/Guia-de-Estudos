import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getReviewCards } from '@/lib/firestore';
import { isDueToday } from '@/lib/sm2';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, BarChart3, PieChart, History,
  Settings, LogOut, Menu, X, ChevronRight, Moon, Sun,
  FolderOpen, HelpCircle, RotateCcw, LineChart, CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlanContext } from '@/contexts/PlanContext';
import { useCountdown } from '@/hooks/useCountdown';
import { PlanSwitcher } from './plans-switcher';

function SidebarCountdown() {
  const { selectedPlan } = usePlanContext();
  const { countdown, isExpired } = useCountdown(selectedPlan?.examDate);

  if (!selectedPlan?.examDate) return null;

  if (isExpired) {
    return (
      <div className="rounded-sm bg-primary/10 border border-primary/20 px-3 py-2 text-center">
        <p className="text-xs font-semibold text-primary">🎉 Prova realizada!</p>
      </div>
    );
  }

  const colorClass =
    countdown.days <= 30 ? 'text-red-400' :
      countdown.days <= 60 ? 'text-amber-400' :
        'text-primary';

  return (
    <div className="rounded-sm bg-background/60 border border-border/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Contagem regressiva
      </p>
      {selectedPlan.examName && (
        <p className="text-[11px] text-foreground/80 font-medium truncate mb-1.5" title={selectedPlan.examName}>
          {selectedPlan.examName}
        </p>
      )}
      <div className="grid grid-cols-4 gap-1">
        {[
          { value: countdown.days, label: 'Dias' },
          { value: countdown.hours, label: 'Hrs' },
          { value: countdown.minutes, label: 'Min' },
          { value: countdown.seconds, label: 'Seg' },
        ].map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center bg-card rounded-sm py-1.5 border border-border/40">
            <span className={cn('text-sm font-bold font-mono tabular-nums leading-none', colorClass)}>
              {String(value).padStart(2, '0')}
            </span>
            <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        const pending = cards.filter(isDueToday).length;
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
        {/* Logo e PlanSwitcher */}
        <div>
          <div className="m-2">
            <PlanSwitcher />
          </div>

          {plans.length > 0 && (
            <div className="mt-4 space-y-3">
              <SidebarCountdown />
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
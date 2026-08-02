import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getReviewCards } from '@/lib/firestore';
import { isDueToday } from '@/lib/sm2';
import {
  LayoutDashboard, BookOpen, BarChart3, PieChart, History,
  Settings, LogOut, ChevronsUpDown, Moon, Sun,
  FolderOpen, HelpCircle, RotateCcw, LineChart, CalendarDays,
} from 'lucide-react';
import { usePlanContext } from '@/contexts/PlanContext';
import { useCountdown } from '@/hooks/useCountdown';
import { PlanSwitcher } from './plans-switcher';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function SidebarCountdown() {
  const { selectedPlan } = usePlanContext();
  const { countdown, isExpired } = useCountdown(selectedPlan?.examDate);

  if (!selectedPlan?.examDate) return null;

  if (isExpired) {
    return (
      <div className="rounded-sm bg-primary/10 border border-primary/20 px-3 py-2 text-center mx-2">
        <p className="text-xs font-semibold text-primary">🎉 Prova realizada!</p>
      </div>
    );
  }

  const colorClass =
    countdown.days <= 30 ? 'text-red-400' :
      countdown.days <= 60 ? 'text-amber-400' :
        'text-primary';

  return (
    <div className="rounded-sm bg-background/60 border border-border/50 px-3 py-2.5 mx-2">
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
            <span className={`text-sm font-bold font-mono tabular-nums leading-none ${colorClass}`}>
              {String(value).padStart(2, '0')}
            </span>
            <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { user, profile, logout } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { plans } = usePlanContext();
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const cards = await getReviewCards(user.uid);
        setReviewCount(cards.filter(isDueToday).length);
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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="m-2">
          <PlanSwitcher />
        </div>
        {plans.length > 0 && (
          <div className="mt-2 space-y-3">
            <SidebarCountdown />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ to, icon: Icon, label, exact, badge }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton>
  <NavLink
    to={to}
    end={exact}
    className={({ isActive }) =>
      isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
    }
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </NavLink>
</SidebarMenuButton>
                  {badge !== undefined && badge > 0 && (
                    <SidebarMenuBadge className="bg-red-500 text-white">
                      {badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
  <SidebarMenuButton size="lg">
                  <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {profile?.displayName?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{profile?.displayName ?? 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                  <ChevronsUpDown className="ml-auto w-4 h-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
                  {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
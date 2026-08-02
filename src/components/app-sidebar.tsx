import * as React from "react"
import {
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LineChart,
  Settings,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { PlanSwitcher } from "./layout/plans-switcher"
import { useAuthContext } from "@/contexts/AuthContext"
import { usePlanContext } from "@/contexts/PlanContext"
import { getReviewCards, getSubjects } from "@/lib/firestore"
import { isDueToday } from "@/lib/sm2"

function formatSubjectName(name: string) {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthContext();
  const { plans, selectedPlanId } = usePlanContext();
  const [reviewCount, setReviewCount] = React.useState(0);
  const [subjects, setSubjects] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (!selectedPlanId) {
      setSubjects([]);
      return;
    }
    (async () => {
      try {
        const subs = await getSubjects(selectedPlanId);
        setSubjects(subs);
      } catch (err) {
        console.error('Failed to load subjects', err);
      }
    })();
  }, [selectedPlanId]);

  const NAV_MAIN = [
    {
      title: 'Estudos',
      url: '#',
      icon: GraduationCap,
      isActive: true,
      items: [
        { title: 'Dashboard', url: '/' },
        { title: 'Planejamentos', url: '/plans' },
        { title: 'Matérias', url: '/subjects' },
        { title: 'Ciclo de estudos', url: '/cycle' },
        { title: 'Calendário', url: '/calendar' },
      ],
    },
    {
      title: 'Prática',
      url: '#',
      icon: ClipboardCheck,
      items: [
        { title: 'Questões', url: '/questions' },
        { title: 'Revisões', url: '/reviews', badge: reviewCount },
        { title: 'Simulados', url: '/exams' },
      ],
    },
    {
      title: 'Desempenho',
      url: '#',
      icon: LineChart,
      items: [
        { title: 'Histórico', url: '/sessions' },
        { title: 'Estatísticas', url: '/statistics' },
      ],
    },
    {
      title: 'Sistema',
      url: '#',
      icon: Settings,
      items: [
        { title: 'Configurações', url: '/settings' },
      ],
    },
  ];

  const subjectProjects = subjects.map((s) => ({
    name: formatSubjectName(s.name),
    url: `/subjects/${s.id}`,
    icon: BookOpen,
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <PlanSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAV_MAIN} />
        {subjectProjects.length > 0 && (
          <NavProjects projects={subjectProjects} />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{
      name: user?.displayName || user?.email?.split('@')[0] || 'Usuário',
      email: user?.email ?? user?.email ?? '',
      avatar: user?.photoURL ?? '',
    }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
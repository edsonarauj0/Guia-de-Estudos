import { Outlet } from 'react-router-dom';
import StudySessionFloatingButton from '@/components/sessions/StudySessionFloatingButton';
import { usePlanContext } from '@/contexts/PlanContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';
import { AppSidebar } from '../app-sidebar';

export default function AppLayout() {
  const { selectedPlanId } = usePlanContext();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <div className="min-h-screen p-6 lg:p-8">
          <div key={selectedPlanId ?? 'no-plan'}>
            <Outlet />
          </div>
        </div>
        <StudySessionFloatingButton />
      </SidebarInset>
    </SidebarProvider>
  );
}
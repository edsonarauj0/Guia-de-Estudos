import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import StudySessionFloatingButton from '@/components/sessions/StudySessionFloatingButton';
import { usePlanContext } from '@/contexts/PlanContext';

export default function AppLayout() {
  const { selectedPlanId } = usePlanContext();
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 lg:ml-64 overflow-y-auto">
        <div className="min-h-screen p-6 lg:p-8">
          <div key={selectedPlanId ?? 'no-plan'}>
            <Outlet />
          </div>
        </div>
      </main>
      <StudySessionFloatingButton />
    </div>
  );
}

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import StudySessionFloatingButton from '@/components/sessions/StudySessionFloatingButton';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 lg:ml-64 overflow-y-auto">
        <div className="min-h-screen p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      <StudySessionFloatingButton />
    </div>
  );
}

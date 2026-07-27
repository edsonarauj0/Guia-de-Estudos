import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStudyPlans } from '@/lib/firestore';
import { useAuthContext } from '@/contexts/AuthContext';
import type { StudyPlan } from '@/types';

interface PlanContextValue {
  plans: StudyPlan[];
  selectedPlanId: string | null;
  selectedPlan: StudyPlan | null;
  selectPlan: (planId: string) => void;
  refreshPlans: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const refreshPlans = useCallback(async () => {
    if (!user) { setPlans([]); setSelectedPlanId(null); return; }
    const availablePlans = await getStudyPlans(user.uid);
    setPlans(availablePlans);
    const storedPlanId = localStorage.getItem('selectedPlanId');
    const id = availablePlans.some(plan => plan.id === storedPlanId)
      ? storedPlanId
      : availablePlans.find(plan => plan.status === 'active')?.id ?? availablePlans[0]?.id ?? null;
    setSelectedPlanId(id);
    if (id) localStorage.setItem('selectedPlanId', id); else localStorage.removeItem('selectedPlanId');
  }, [user]);

  useEffect(() => { refreshPlans(); }, [refreshPlans]);

  const selectPlan = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    localStorage.setItem('selectedPlanId', planId);
  }, []);

  const value = useMemo(() => ({
    plans,
    selectedPlanId,
    selectedPlan: plans.find(plan => plan.id === selectedPlanId) ?? null,
    selectPlan,
    refreshPlans,
  }), [plans, selectedPlanId, selectPlan, refreshPlans]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlanContext() {
  const context = useContext(PlanContext);
  if (!context) throw new Error('usePlanContext deve ser usado dentro de PlanProvider');
  return context;
}

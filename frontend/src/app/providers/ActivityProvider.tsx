import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export type ActivityTone = 'info' | 'success' | 'error';

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  tone: ActivityTone;
}

interface ActivityInput {
  title: string;
  description: string;
  tone?: ActivityTone;
}

interface ActivityContextValue {
  activities: ActivityItem[];
  addActivity: (activity: ActivityInput) => void;
  clearActivities: () => void;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  function addActivity({
    title,
    description,
    tone = 'info',
  }: ActivityInput) {
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        title,
        description,
        occurredAt: new Date().toISOString(),
        tone,
      },
      ...current,
    ].slice(0, 20));
  }

  return (
    <ActivityContext.Provider
      value={{
        activities,
        addActivity,
        clearActivities: () => setActivities([]),
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within ActivityProvider');
  }
  return context;
}

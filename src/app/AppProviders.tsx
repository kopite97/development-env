import type { ReactNode } from 'react';
import { DashboardProvider } from '../features/dashboard/DashboardProvider';
import { JournalsProvider } from '../features/journal/JournalsProvider';
import { TasksProvider } from '../features/tasks/TasksProvider';
import { WorkspaceProvider } from './WorkspaceProvider';
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TasksProvider>
      <JournalsProvider>
        <DashboardProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </DashboardProvider>
      </JournalsProvider>
    </TasksProvider>
  );
}

import { LinksProvider } from '../features/links/LinksProvider';
import type { ReactNode } from 'react';
import { DashboardProvider } from '../features/dashboard/DashboardProvider';
import { JournalsProvider } from '../features/journal/JournalsProvider';
import { TasksProvider } from '../features/tasks/TasksProvider';
import { WorkspaceProvider } from './WorkspaceProvider';
import { ProjectsProvider } from '../features/projects/ProjectsProvider';
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ProjectsProvider>
      <TasksProvider>
        <JournalsProvider>
          <DashboardProvider>
            <LinksProvider>
              <WorkspaceProvider>{children}</WorkspaceProvider>
            </LinksProvider>
          </DashboardProvider>
        </JournalsProvider>
      </TasksProvider>
    </ProjectsProvider>
  );
}

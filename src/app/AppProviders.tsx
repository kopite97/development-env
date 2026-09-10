import { LinksProvider } from '../features/links/LinksProvider';
import type { ReactNode } from 'react';
import { DashboardProvider } from '../features/dashboard/DashboardProvider';
import { JournalsProvider } from '../features/journal/JournalsProvider';
import { TasksProvider } from '../features/tasks/TasksProvider';
import { WorkspaceProvider } from './WorkspaceProvider';
import { ProjectsProvider } from '../features/projects/ProjectsProvider';
import { MilestonesProvider } from '../features/milestones/MilestonesProvider';
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ProjectsProvider>
      <TasksProvider>
        <JournalsProvider>
          <DashboardProvider>
            <LinksProvider>
              <MilestonesProvider>
                <WorkspaceProvider>{children}</WorkspaceProvider>
              </MilestonesProvider>
            </LinksProvider>
          </DashboardProvider>
        </JournalsProvider>
      </TasksProvider>
    </ProjectsProvider>
  );
}

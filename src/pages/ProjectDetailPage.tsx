import type { PagePresentation } from './pageInputs';
import type { DetailHandler } from '../shared/types/ui';
import { EmptyState } from '../shared/ui/controls';
import { ProjectDetailLayout } from '../features/projects/ProjectDetailLayout';
import { useProjects } from '../features/projects/ProjectsProvider';
import { useProjectEditor } from '../features/projects/useProjectEditor';
import { ProjectSummary } from '../features/projects/ProjectSummary';
import { useTasks } from '../features/tasks/TasksProvider';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { useJournals } from '../features/journal/JournalsProvider';
import { RecentJournals } from '../features/journal/RecentJournals';
import { MilestoneList } from '../features/milestones/MilestoneList';
export function ProjectDetailPage({
  scaffold,
  projectId,
  onBack: closeProject,
  onDetail,
  onArchivedChange: setShowArchivedProjects,
}: PagePresentation & {
  projectId: string;
  onBack: () => void;
  onDetail: DetailHandler;
  onArchivedChange: (archived: boolean) => void;
}) {
  const { projects } = useProjects();
  const { tasks, changeStatus } = useTasks();
  const { journals } = useJournals();
  const project = projects.find((p) => p.id === projectId);
  const editor = useProjectEditor(project, setShowArchivedProjects);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const projectJournals = journals
    .filter((j) => j.projectId === projectId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <ProjectDetailLayout
      title={project?.name ?? '프로젝트를 찾을 수 없어요'}
      onBack={closeProject}
      actions={editor.action}
      feedback={scaffold.feedback}
    >
      {!project ? (
        <EmptyState title="프로젝트가 없거나 더 이상 접근할 수 없어요" />
      ) : (
        <>
          <ProjectSummary project={project} />
          <section className="content-panel" aria-label="프로젝트 마일스톤">
            <div className="panel-heading">
              <h2>마일스톤</h2>
              <p>목표와 기한을 관리하세요.</p>
            </div>
            <MilestoneList scope="all" projects={[project]} projectId={project.id} />
          </section>
          <section className="content-panel" aria-label="프로젝트 작업">
            <div className="panel-heading">
              <h2>연결된 작업</h2>
              <p>
                전체 {projectTasks.length}개 · 진행 중{' '}
                {projectTasks.filter((t) => t.status === 'doing').length}개 · 완료{' '}
                {projectTasks.filter((t) => t.status === 'done').length}개
              </p>
            </div>
            {projectTasks.length ? (
              <TaskBoard scope="all" tasks={projectTasks} onTaskChange={changeStatus} />
            ) : (
              <EmptyState title="연결된 작업이 없어요" />
            )}
          </section>
          <section className="content-panel" aria-label="프로젝트 최근 일지">
            <div className="panel-heading">
              <h2>최근 개발 일지</h2>
              <p>이 프로젝트의 최신 일지 최대 3건입니다.</p>
            </div>
            {projectJournals.length ? (
              <RecentJournals scope="all" journals={projectJournals} onDetail={onDetail} />
            ) : (
              <EmptyState title="연결된 개발 일지가 없어요" />
            )}
          </section>
          {editor.dialog}
        </>
      )}
    </ProjectDetailLayout>
  );
}

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '../../shared/ui/controls';
import { ProjectEditor } from './ProjectEditor';
import { useProjects } from './ProjectsProvider';
import type { Project } from './model';

export function useProjectEditor(
  project: Project | undefined,
  onArchivedChange: (archived: boolean) => void,
) {
  const [isEditing, setIsEditing] = useState(false);
  const { upsert, archive } = useProjects();
  return {
    action: project && (
      <Button onClick={() => setIsEditing(true)}>
        <Pencil size={16} />
        프로젝트 편집
      </Button>
    ),
    dialog: project && isEditing && (
      <ProjectEditor
        existing={project}
        onClose={() => setIsEditing(false)}
        onSave={(next) => {
          const saved = upsert(next);
          if (saved) onArchivedChange(next.archived);
          return saved;
        }}
        onArchive={(id, archived) => {
          const saved = archive(id, archived);
          if (saved) onArchivedChange(archived);
          return saved;
        }}
      />
    ),
  };
}

import { useProjects } from '../projects/ProjectsProvider';
import { WidgetEditorView } from './WidgetEditorView';
import type { Widget } from './model';

export function WidgetEditor(props: {
  existing?: Widget;
  onSave: (widget: Widget) => void;
  onClose: () => void;
}) {
  const { projects } = useProjects();
  return (
    <WidgetEditorView
      {...props}
      projects={projects}
      onSave={(widget) => {
        if (!widget.scope) throw new Error('Missing legacy scope');
        props.onSave({ ...widget, scope: widget.scope });
      }}
    />
  );
}

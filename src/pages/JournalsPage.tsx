import { JournalWorkspace, type JournalWorkspaceProps } from '../features/journal/JournalWorkspace';

export function JournalsPage(props: JournalWorkspaceProps) {
  return <JournalWorkspace {...props} />;
}

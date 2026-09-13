import type { ApiMilestone, MilestoneDraft } from './apiModel';
import type { MilestoneCreateIntent } from './apiIntent';
export type MilestoneEditorMemory = {
  target: string;
  draft: MilestoneDraft;
  initialDraft?: MilestoneDraft;
  baseline?: ApiMilestone;
  intent?: MilestoneCreateIntent;
  confirmedId?: string;
  review?: boolean;
  notice?: string;
};
export type MilestoneMemory = { editor?: MilestoneEditorMemory };

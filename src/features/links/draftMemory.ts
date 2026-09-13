import type { ApiLink, LinkDraft } from './apiModel';
import type { LinkIntent } from './apiIntent';
export type LinkEditorMemory = {
  draft: LinkDraft;
  baseline?: ApiLink;
  intent?: LinkIntent;
  review?: boolean;
  confirmedId?: string;
  notice?: string;
};
export type LinkMemory = { editor?: LinkEditorMemory };

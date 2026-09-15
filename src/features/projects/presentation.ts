import type { Project } from './model';

// Shared presentation does not require legacy classification on server-backed rows.
export type ProjectPresentation = Omit<Project, 'scope'> & { scope?: Project['scope'] };

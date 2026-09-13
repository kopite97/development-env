import type { ApiDashboard, DashboardSave } from './apiModel';
import type { Widget } from './model';
export type WidgetForm = Omit<Widget, 'limit'> & { limitText: string };
export type DashboardEditorMemory = {
  baseline: ApiDashboard;
  draft: Widget[];
  widget?: { existing: boolean; form: WidgetForm };
  submitted?: DashboardSave;
  review?: boolean;
  notice?: string;
};
export type DashboardMemory = { editor?: DashboardEditorMemory };

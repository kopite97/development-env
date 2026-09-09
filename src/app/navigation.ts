import { BookOpen, FolderKanban, Home, LayoutDashboard, Library } from 'lucide-react';
export const navigationItems = [
  { label: '나의 홈', icon: Home },
  { label: '프로젝트', icon: FolderKanban },
  { label: '작업 보드', icon: LayoutDashboard },
  { label: '개발 일지', icon: BookOpen },
  { label: '자료실', icon: Library },
] as const;
export type PageId = (typeof navigationItems)[number]['label'];

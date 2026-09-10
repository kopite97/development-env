import {
  BookOpen,
  Check,
  ExternalLink,
  Layers3,
  Server,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { WidgetType } from './model';

export const widgetCatalog: Record<
  WidgetType,
  { title: string; description: string; icon: LucideIcon }
> = {
  overview: {
    title: '프로젝트 한눈에 보기',
    description: '진행률과 작업 현황을 한곳에서 확인해요.',
    icon: Layers3,
  },
  board: {
    title: '작업 보드',
    description: '할 일부터 완료까지 작업 흐름을 관리해요.',
    icon: Check,
  },
  deploy: {
    title: '운영 · 배포 현황',
    description: '서비스 상태와 최근 배포 버전을 확인해요.',
    icon: Server,
  },
  links: {
    title: '빠른 링크',
    description: '자주 사용하는 개발 도구로 이동해요.',
    icon: ExternalLink,
  },
  journal: {
    title: '최근 개발 일지',
    description: '개발 과정과 다음 할 일을 되짚어 봐요.',
    icon: BookOpen,
  },
  milestone: {
    title: '다가오는 마일스톤',
    description: '프로젝트의 다음 목표를 확인해요.',
    icon: Timer,
  },
};

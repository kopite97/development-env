import { ChevronRight, Flag } from 'lucide-react';
import { projects, type Scope } from '../../data/demo';
import type { DetailHandler } from '../../types/ui';
export function MilestoneList({ scope, onDetail }: { scope: Scope; onDetail: DetailHandler }) {
  return (
    <div className="milestones">
      {projects
        .filter((p) => scope === 'all' || p.scope === scope)
        .slice(0, 2)
        .map((p, i) => (
          <button
            key={p.id}
            className="milestone"
            onClick={() =>
              onDetail(
                p.milestone,
                `${p.name}의 다음 목표입니다.\n현재 진행률: ${p.progress}%\n\n예시 마일스톤입니다.`,
              )
            }
          >
            <span className="milestone-icon">
              <Flag size={16} />
            </span>
            <span>
              <small>{p.name}</small>
              <strong>{p.milestone}</strong>
              <span className="muted">{i ? '09.30' : '09.18'} 목표 · 예시</span>
            </span>
            <ChevronRight size={14} />
          </button>
        ))}
    </div>
  );
}

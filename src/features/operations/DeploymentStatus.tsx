import { Circle, GitBranch, Globe, Server } from 'lucide-react';
import { Badge, EmptyState } from '../../shared/ui/controls';
import { type Scope } from '../projects/scope';
import type { DetailHandler } from '../../shared/types/ui';
export function DeploymentStatus({ scope, onDetail }: { scope: Scope; onDetail: DetailHandler }) {
  if (scope === 'unity')
    return (
      <EmptyState title="등록된 서비스가 없어요">
        <p>서버 · 웹 개발 범위를 선택해 보세요.</p>
      </EmptyState>
    );
  return (
    <>
      <div className="service-summary">
        <span className="live-dot" />
        모든 시스템 정상<span>예시</span>
      </div>
      {[
        { name: 'Devspace API', stack: 'Spring Boot', version: 'v1.2.0', icon: Server },
        { name: 'Devspace Web', stack: 'React · Vercel', version: 'v0.8.2', icon: Globe },
      ].map((s) => (
        <button
          className="service-row"
          key={s.name}
          onClick={() =>
            onDetail(
              s.name,
              `${s.stack}\n최근 배포 버전: ${s.version}\n\n이 상태는 예시 데이터이며 실시간 모니터링 결과가 아닙니다. 실제 운영 상태를 표시하려면 상태 확인 API와 배포 제공자 연결이 필요합니다.`,
            )
          }
        >
          <s.icon size={18} />
          <span>
            <strong>{s.name}</strong>
            <small>{s.stack}</small>
          </span>
          <Badge tone="green">정상</Badge>
          <div className="service-version">
            <GitBranch size={12} />
            {s.version}
            <span>예시 배포</span>
          </div>
        </button>
      ))}
      <div className="widget-footnote">
        <Circle size={11} />
        실시간 연동 전 · 데모 데이터
      </div>
    </>
  );
}

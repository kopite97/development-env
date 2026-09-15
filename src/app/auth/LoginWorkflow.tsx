import { Boxes, CircleCheck, GitCommitHorizontal, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBlueprintPointer } from '../../shared/hooks/useBlueprintPointer';
import { workflowStages } from './loginWorkflowModel';
import { DevelopmentStack } from './DevelopmentStack';
import './login-workflow.css';

const stageIcons = [GitCommitHorizontal, Boxes, CircleCheck, Rocket];
const desktopQuery = '(min-width: 1024px)';

export function LoginWorkflow() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(desktopQuery).matches);
  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);
  return isDesktop ? <WorkflowPreview /> : null;
}

function WorkflowPreview() {
  const [active, setActive] = useState<number | null>(null);
  const [dismissedTooltip, setDismissedTooltip] = useState<string | null>(null);
  const blueprintRef = useBlueprintPointer(({ x, target }) => {
    if (
      !(target instanceof Element) ||
      !target.closest('.login-workflow-track') ||
      target.closest('.login-workflow-technologies')
    )
      return;
    const nodes = target
      .closest('.login-workflow-track')
      ?.querySelectorAll<HTMLButtonElement>('.login-workflow-node');
    if (!nodes?.length) return;
    const centers = Array.from(nodes, (node) => {
      const rect = node.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    const nearest = centers.reduce(
      (best, center, index) => (Math.abs(x - center) < Math.abs(x - centers[best]) ? index : best),
      0,
    );
    if (active !== null && nearest !== active) {
      const boundary = (centers[nearest] + centers[active]) / 2;
      if (Math.abs(x - boundary) < 16) return;
    }
    if (nearest !== active) setActive(nearest);
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissedTooltip('*');
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <section
      className="login-workflow blueprint-surface"
      ref={blueprintRef}
      aria-label="Development workflow"
    >
      <div
        className="login-workflow-track"
        role="group"
        aria-label="개발 단계"
        data-active-stage={active ?? undefined}
        onPointerLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement)) setActive(null);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setActive(null);
        }}
      >
        {workflowStages.map((stage, index) => {
          const Icon = stageIcons[index];
          return (
            <div className="login-workflow-stage" key={stage.id}>
              <button
                className="login-workflow-node"
                type="button"
                aria-label={stage.label}
                aria-pressed={active === index}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
              >
                <Icon size={24} aria-hidden="true" />
              </button>
              <span className="login-workflow-label" aria-hidden="true">
                {stage.label}
              </span>
              {active === index && (
                <div className="login-workflow-technologies" key={stage.id}>
                  <div className="login-workflow-icons">
                    {stage.technologies.map((technology) => (
                      <span
                        className="login-workflow-technology"
                        key={technology.name}
                        tabIndex={0}
                        role="img"
                        aria-label={technology.name}
                        data-dismissed={
                          dismissedTooltip === '*' || dismissedTooltip === technology.name
                        }
                        onPointerEnter={() => setDismissedTooltip(null)}
                        onFocus={() => setDismissedTooltip(null)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') setDismissedTooltip(technology.name);
                        }}
                      >
                        <img src={technology.src} width={32} height={32} alt="" />
                        <span className="login-workflow-tooltip" aria-hidden="true">
                          {technology.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <DevelopmentStack />
    </section>
  );
}

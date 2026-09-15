import { useEffect, useState } from 'react';
import { Cloud, CodeXml, Database, GitPullRequest, MessagesSquare } from 'lucide-react';
import vscode from './assets/workflow/vscode-original.svg';
import intellij from './assets/workflow/intellij-original.svg';
import visualstudio from './assets/workflow/visualstudio-original.svg';
import rider from './assets/workflow/rider-original.svg';
import mysql from './assets/workflow/mysql-original.svg';
import postgresql from './assets/workflow/postgresql-original.svg';
import mariadb from './assets/workflow/mariadb-original.svg';
import oracle from './assets/workflow/oracle-original.svg';
import sqlserver from './assets/workflow/microsoftsqlserver-original.svg';
import kafka from './assets/workflow/apachekafka-original.svg';
import rabbitmq from './assets/workflow/rabbitmq-original.svg';
import redis from './assets/workflow/redis-original.svg';
import githubactions from './assets/workflow/githubactions-original.svg';
import jenkins from './assets/workflow/jenkins-original.svg';
import docker from './assets/workflow/docker-original.svg';
import kubernetes from './assets/workflow/kubernetes-original.svg';
import aws from './assets/workflow/amazonwebservices-original-wordmark.svg';

const categories: {
  name: string;
  technologies: { name: string; src: string; emphasis?: 'planned' | 'secondary' }[];
}[] = [
  {
    name: 'IDE',
    technologies: [
      { name: 'VS Code', src: vscode },
      { name: 'IntelliJ IDEA', src: intellij },
      { name: 'Visual Studio', src: visualstudio },
      { name: 'JetBrains Rider', src: rider },
    ],
  },
  {
    name: 'RDBMS',
    technologies: [
      { name: 'MySQL', src: mysql },
      { name: 'PostgreSQL', src: postgresql },
      { name: 'MariaDB', src: mariadb },
      { name: 'Oracle Database', src: oracle },
      { name: 'Microsoft SQL Server', src: sqlserver },
    ],
  },
  {
    name: 'Messaging',
    technologies: [
      { name: 'Kafka', src: kafka },
      { name: 'RabbitMQ', src: rabbitmq },
      { name: 'Redis', src: redis },
    ],
  },
  {
    name: 'CI/CD',
    technologies: [
      { name: 'GitHub Actions', src: githubactions },
      { name: 'Jenkins', src: jenkins, emphasis: 'planned' },
    ],
  },
  {
    name: 'Cloud & Infra',
    technologies: [
      { name: 'Docker', src: docker },
      { name: 'AWS', src: aws },
      { name: 'Kubernetes', src: kubernetes, emphasis: 'secondary' },
    ],
  },
];
const categoryIcons = [CodeXml, Database, MessagesSquare, GitPullRequest, Cloud];

export function DevelopmentStack() {
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const active = preview ?? selected;
  const [isTooltipDismissed, setIsTooltipDismissed] = useState(false);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTooltipDismissed(true);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <section
      className="login-development-stack"
      aria-label="기술 스택"
      onPointerLeave={() => setPreview(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPreview(null);
      }}
    >
      <div className="login-stack-categories" role="group" aria-label="기술 카테고리">
        {categories.map((category, index) => {
          const Icon = categoryIcons[index];
          return (
            <button
              key={category.name}
              type="button"
              className="login-stack-category"
              aria-pressed={selected === index}
              data-preview={preview === index}
              onPointerEnter={() => setPreview(index)}
              onFocus={() => setPreview(index)}
              onClick={() => setSelected(index)}
            >
              <Icon size={16} aria-hidden="true" />
              {category.name}
            </button>
          );
        })}
      </div>
      <div className="login-stack-lane">
        {active !== null && (
          <div
            className="login-workflow-icons"
            key={active}
            role="group"
            aria-label={categories[active].name}
          >
            {categories[active].technologies.map((technology) => (
              <span
                key={technology.name}
                className="login-workflow-technology"
                role="img"
                tabIndex={0}
                aria-label={`${technology.name}${technology.emphasis === 'planned' ? ' (사용 예정)' : ''}`}
                data-dismissed={isTooltipDismissed}
                data-emphasis={technology.emphasis}
                onPointerEnter={() => setIsTooltipDismissed(false)}
                onFocus={() => setIsTooltipDismissed(false)}
              >
                <img src={technology.src} width={32} height={32} alt="" />
                <span className="login-stack-technology-name" aria-hidden="true">
                  {technology.name}
                </span>
                <span className="login-workflow-tooltip" aria-hidden="true">
                  {technology.name}
                  {technology.emphasis === 'planned' ? ' · 사용 예정' : ''}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

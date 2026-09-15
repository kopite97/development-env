import git from './assets/workflow/git-original.svg';
import github from './assets/workflow/github-original.svg';
import gitlab from './assets/workflow/gitlab-original.svg';
import docker from './assets/workflow/docker-original.svg';
import gradle from './assets/workflow/gradle-original.svg';
import maven from './assets/workflow/maven-original.svg';
import npm from './assets/workflow/npm-original-wordmark.svg';
import junit from './assets/workflow/junit-original.svg';
import jest from './assets/workflow/jest-plain.svg';
import playwright from './assets/workflow/playwright-original.svg';
import aws from './assets/workflow/amazonwebservices-original-wordmark.svg';
import kubernetes from './assets/workflow/kubernetes-original.svg';
import vercel from './assets/workflow/vercel-original.svg';

export const workflowStages = [
  {
    id: 'commit',
    label: 'Commit',
    technologies: [
      { name: 'Git', src: git },
      { name: 'GitHub', src: github },
      { name: 'GitLab', src: gitlab },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    technologies: [
      { name: 'Docker', src: docker },
      { name: 'Gradle', src: gradle },
      { name: 'Maven', src: maven },
      { name: 'npm', src: npm },
    ],
  },
  {
    id: 'test',
    label: 'Test',
    technologies: [
      { name: 'JUnit', src: junit },
      { name: 'Jest', src: jest },
      { name: 'Playwright', src: playwright },
    ],
  },
  {
    id: 'deploy',
    label: 'Deploy',
    technologies: [
      { name: 'AWS', src: aws },
      { name: 'Kubernetes', src: kubernetes },
      { name: 'Vercel', src: vercel },
    ],
  },
] as const;

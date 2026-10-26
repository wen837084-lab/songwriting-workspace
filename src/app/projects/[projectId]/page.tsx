import { ProjectPage } from "../../../features/projects/project-page";

interface ProjectRouteProps {
  params: Promise<{ projectId: string }>;
}

export function generateStaticParams() {
  return [{ projectId: "__desktop_placeholder__" }];
}

export default async function ProjectRoute({ params }: ProjectRouteProps) {
  const { projectId } = await params;
  return <ProjectPage projectId={projectId} />;
}

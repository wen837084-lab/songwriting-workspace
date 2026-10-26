import { ProjectToolsPage } from "../../../../features/projects/project-tools-page";

interface ProjectToolsRouteProps {
  params: Promise<{ projectId: string }>;
}

export function generateStaticParams() {
  return [{ projectId: "__desktop_placeholder__" }];
}

export default async function ProjectToolsRoute({ params }: ProjectToolsRouteProps) {
  const { projectId } = await params;
  return <ProjectToolsPage projectId={projectId} />;
}

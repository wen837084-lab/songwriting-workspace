import { notFound } from "next/navigation";
import { getProjectToolDefinition } from "../../../../../features/navigation/navigation";
import { ProjectToolsPage } from "../../../../../features/projects/project-tools-page";

interface ProjectToolRouteProps {
  params: Promise<{ projectId: string; tool: string }>;
}

export function generateStaticParams() {
  return [{ projectId: "__desktop_placeholder__", tool: "learning" }];
}

export default async function ProjectToolRoute({ params }: ProjectToolRouteProps) {
  const { projectId, tool } = await params;
  const definition = getProjectToolDefinition(tool);
  if (!definition) notFound();
  return <ProjectToolsPage projectId={projectId} tool={definition.slug} />;
}

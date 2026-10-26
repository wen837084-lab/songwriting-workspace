import { ProjectReviewPage } from "../../../../features/projects/project-review-page";

interface ProjectReviewRouteProps {
  params: Promise<{ projectId: string }>;
}

export function generateStaticParams() {
  return [{ projectId: "__desktop_placeholder__" }];
}

export default async function ProjectReviewRoute({ params }: ProjectReviewRouteProps) {
  const { projectId } = await params;
  return <ProjectReviewPage projectId={projectId} />;
}

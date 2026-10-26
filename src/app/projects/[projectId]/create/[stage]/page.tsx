import { notFound, redirect } from "next/navigation";
import { JourneyPage } from "../../../../../features/creation-journey/journey-page";
import { getStageFromSlug } from "../../../../../features/creation-journey/stages";

interface JourneyRouteProps {
  params: Promise<{ projectId: string; stage: string }>;
}

export function generateStaticParams() {
  return [{ projectId: "__desktop_placeholder__", stage: "idea" }];
}

export default async function JourneyRoute({ params }: JourneyRouteProps) {
  const { projectId, stage: stageSlug } = await params;
  const stage = getStageFromSlug(stageSlug);
  if (!stage) notFound();
  if (stage === "Review") redirect(`/projects/${projectId}/review`);
  return <JourneyPage projectId={projectId} stage={stage} />;
}

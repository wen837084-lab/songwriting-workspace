import { DesktopRouter } from "../features/desktop/desktop-router";
import { ProjectsDashboard } from "../features/projects/projects-dashboard";

export default function Home() {
  if (process.env.NEXT_PUBLIC_DESKTOP_STATIC === "true") {
    return <DesktopRouter />;
  }
  return <ProjectsDashboard />;
}

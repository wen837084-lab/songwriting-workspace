import type { ProjectSummary } from "../project/project";
import type { SkillProgress } from "./skill-map";

export interface WorkspaceState {
  workspaceId: string;
  projectIndex: ProjectSummary[];
  skillProgress: SkillProgress[];
}

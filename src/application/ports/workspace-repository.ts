import type {
  SkillId,
  SkillProgress,
  SkillState,
} from "../../domain/workspace/skill-map";

export interface WorkspaceRepository {
  getSkillProgress(): SkillProgress[];
  updateSkillProgress(skillId: SkillId, state: SkillState): SkillProgress[];
}

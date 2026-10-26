import type { WorkspaceRepository } from "../../application/ports/workspace-repository";
import type {
  SkillId,
  SkillProgress,
  SkillState,
} from "../../domain/workspace/skill-map";
import { LocalProjectRepository } from "./local-project-repository";
import type { KeyValueStorage } from "./storage";

export class LocalWorkspaceRepository implements WorkspaceRepository {
  private readonly projectRepository: LocalProjectRepository;

  constructor(storage: KeyValueStorage) {
    this.projectRepository = new LocalProjectRepository(storage);
  }

  getSkillProgress(): SkillProgress[] {
    return this.projectRepository.getSkillProgress();
  }

  updateSkillProgress(skillId: SkillId, state: SkillState): SkillProgress[] {
    return this.projectRepository.updateSkillProgress(skillId, state);
  }
}

import { SkillMap } from "../learning/skill-map";
import { LearningLibrary } from "../learning/learning-library";
import { WorkspaceNavigation } from "./workspace-navigation";

export function LearningWorkspacePage() {
  return (
    <main className="shell">
      <WorkspaceNavigation current="learning" />
      <header className="page-header">
        <p className="eyebrow">Workspace</p>
        <h1>学习资料库 Learning Library</h1>
        <p className="lede">在这里探索概念和练习，需要创作时再回到 Song Project。</p>
      </header>
      <LearningLibrary />
    </main>
  );
}

export function SkillsWorkspacePage() {
  return (
    <main className="shell">
      <WorkspaceNavigation current="skills" />
      <header className="page-header">
        <p className="eyebrow">Workspace</p>
        <h1>Skill Map</h1>
        <p className="lede">记录你在不同 Project 中自己的学习轨迹。这里不会评分，也不会自动更新。</p>
      </header>
      <SkillMap />
    </main>
  );
}

export function SettingsWorkspacePage() {
  return (
    <main className="shell">
      <WorkspaceNavigation current="settings" />
      <header className="page-header">
        <p className="eyebrow">Workspace</p>
        <h1>设置</h1>
        <p className="lede">Workspace 层级的行为和本地数据说明。</p>
      </header>
      <section className="settings-panel" aria-labelledby="local-data-heading">
        <p className="eyebrow">当前设置</p>
        <h2 id="local-data-heading">Local-first Workspace</h2>
        <p>项目和 Skill Map 状态保存在此浏览器中。这个 Workspace 不包含账号、云同步、计费或协作功能。</p>
        <p>当前产品能力不需要其他偏好设置。</p>
      </section>
    </main>
  );
}

import { AppLink } from "../navigation/app-link";

export function ProjectRouteState({
  isLoading,
  error,
}: {
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <main className="shell">
      <AppLink className="back-link" href="/">← 返回 Workspace / 项目</AppLink>
      {error ? <div className="error-message" role="alert">{error}</div> : null}
      {isLoading ? <p className="empty-state">正在加载项目…</p> : null}
      {!isLoading ? (
        <section className="empty-state">
          <h1>未找到 Project</h1>
          <p>本地存储中不存在这个 Project。</p>
        </section>
      ) : null}
    </main>
  );
}

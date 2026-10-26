import { AppLink } from "./app-link";
import {
  WORKSPACE_NAV_ITEMS,
  type WorkspaceNavigationId,
} from "./navigation";

export function WorkspaceNavigation({ current }: { current: WorkspaceNavigationId }) {
  return (
    <nav className="workspace-nav" aria-label="Workspace 导航">
      <AppLink className="workspace-home" href="/">Songwriting Workspace</AppLink>
      <div className="workspace-nav-items">
        {WORKSPACE_NAV_ITEMS.map((item) => (
          <AppLink
            className={item.id === current ? "workspace-nav-link active" : "workspace-nav-link"}
            href={item.href}
            aria-current={item.id === current ? "page" : undefined}
            key={item.id}
          >
            {item.label}
          </AppLink>
        ))}
      </div>
    </nav>
  );
}

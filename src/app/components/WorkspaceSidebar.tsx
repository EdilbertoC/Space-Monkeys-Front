// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import { ApiStatusBadge } from "../../features/system/components/SystemStatus";
import { Icon } from "../../shared/ui/ui";
import { groups, pages, type WorkspacePage } from "../navigation";
import SolisMark from "./SolisMark";

export default function WorkspaceSidebar({
  menu,
  page,
  navigate,
}: {
  menu: boolean;
  page: WorkspacePage;
  navigate: (page: WorkspacePage) => void;
}) {
  return (
    <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
      <a
        href="#"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          navigate("Territory");
        }}
        aria-label="Solis, back to the start"
      >
        <span className="brand-mark">
          <SolisMark size={32} />
        </span>
        <span>
          <span className="brand-word">Solis</span>
          <small>Brazil fire record since 2000</small>
        </span>
      </a>
      <nav aria-label="Pages">
        {groups.map((g) => (
          <div key={g.id} className="nav-group">
            <div className="nav-label">
              <span>{g.label}</span>
              {g.tag && <span className={`nav-tag nav-tag-${g.tone}`}>{g.tag}</span>}
            </div>
            {pages
              .filter((p) => p.group === g.id)
              .map((p) => (
                <button
                  key={p.name}
                  className={`nav-item ${page === p.name ? "active" : ""}`}
                  aria-current={page === p.name ? "page" : undefined}
                  onClick={() => navigate(p.name)}
                >
                  <Icon name={p.icon} size={17} />
                  <span>{p.label}</span>
                </button>
              ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <ApiStatusBadge />
      </div>
    </aside>
  );
}

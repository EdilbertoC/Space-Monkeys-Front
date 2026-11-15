// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import { ApiStatusBadge } from "../../features/system/components/SystemStatus";
import { Icon } from "../../shared/ui/ui";
import { groups, pages, type WorkspacePage } from "../navigation";

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
        aria-label="OrbitBurn, back to the start"
      >
        <span className="brand-mark">
          <Icon name="flame" size={22} />
        </span>
        <span>
          OrbitBurn
          <small>Brazil fire record since 2000</small>
        </span>
      </a>
      <nav aria-label="Pages">
        {groups.map((g) => (
          <div key={g.id} className="nav-group">
            <div className="nav-label">{g.label}</div>
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

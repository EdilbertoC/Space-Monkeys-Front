import { Dot, Icon } from "../../shared/ui/ui";
import { pages, type WorkspacePage } from "../navigation";
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
          navigate("Overview");
        }}
        aria-label="OrbitBurn overview"
      >
        <span className="brand-mark">
          <Icon name="flame" size={26} />
          <i />
        </span>
        <span>
          Orbit<span className="brand-light">Burn</span>
          <small>EARTH OBSERVATION INTELLIGENCE</small>
        </span>
      </a>
      <div className="workspace-tag">
        <span className="workspace-icon">
          <Icon name="globe" size={15} />
        </span>
        <span>
          Global workspace<small>Research environment</small>
        </span>
        <Icon name="chevron" size={13} />
      </div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        {pages.map((p) => (
          <button
            key={p.name}
            className={`nav-item ${page === p.name ? "active" : ""} ${p.name === "Settings" ? "settings-nav" : ""}`}
            aria-current={page === p.name ? "page" : undefined}
            onClick={() => navigate(p.name)}
          >
            <Icon name={p.icon} size={18} />
            <span>{p.name}</span>
            {page === p.name && <i />}
            {p.name === "Fire Map" && <span className="nav-badge">MAP</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="system-status">
          <Dot />
          <span>
            Demo systems operational<small>OrbitBurn v1.0.0</small>
          </span>
          <Icon name="info" size={13} />
        </div>
      </div>
    </aside>
  );
}

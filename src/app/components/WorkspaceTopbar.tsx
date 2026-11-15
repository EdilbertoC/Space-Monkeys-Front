// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import { Icon } from "../../shared/ui/ui";
import { labelOf, type WorkspacePage } from "../navigation";

export default function WorkspaceTopbar({
  page,
  onOpenInfo,
  onOpenMenu,
}: {
  page: WorkspacePage;
  onOpenInfo: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <div className="topbar">
      <div className="breadcrumb">
        <button
          className="mobile-menu icon-button"
          aria-label="Open navigation"
          onClick={() => onOpenMenu()}
        >
          <Icon name="menu" />
        </button>
        <strong>{labelOf(page)}</strong>
      </div>
      <div className="topbar-right">
        <button className="topbar-about" onClick={onOpenInfo}>
          <Icon name="info" size={15} /> How the record is built
        </button>
      </div>
    </div>
  );
}

import type { Dispatch, SetStateAction } from "react";
import { Dot, Icon } from "../../shared/ui/ui";
import { type WorkspacePage } from "../navigation";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function WorkspaceTopbar({
  page,
  notifications,
  setNotifications,
  profile,
  setProfile,
  navigate,
  onOpenInfo,
  onOpenMenu,
}: {
  page: WorkspacePage;
  notifications: boolean;
  setNotifications: Dispatch<SetStateAction<boolean>>;
  profile: boolean;
  setProfile: Dispatch<SetStateAction<boolean>>;
  navigate: (page: WorkspacePage) => void;
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
        <span>Workspace</span>
        <span className="breadcrumb-slash">/</span>
        <strong>{page}</strong>
      </div>
      <div className="topbar-right">
        <span className="environment" title={API_URL}>
          <Dot color="green" /> Data: Space Monkeys API
        </span>
        <span className="topbar-divider" />
        <div className="popover-anchor">
          <button
            className="notification-button icon-button"
            aria-label="Notifications"
            aria-expanded={notifications}
            onClick={() => {
              setNotifications(!notifications);
              setProfile(false);
            }}
          >
            <Icon name="bell" size={19} />
          </button>
          {notifications && (
            <div className="popover notifications-popover">
              <div className="empty-state">
                The backend does not push alerts yet. Unusual months are computed on request in
                Anomaly Alerts, and the 7-day outlook is in Risk Forecast.
              </div>
              <div className="notification-item">
                <span className="notification-icon">
                  <Icon name="alert" />
                </span>
                <div>
                  <button
                    className="text-link"
                    onClick={() => {
                      navigate("Anomaly Alerts");
                      setNotifications(false);
                    }}
                  >
                    Open Anomaly Alerts <Icon name="arrow" size={12} />
                  </button>
                  <button
                    className="text-link"
                    onClick={() => {
                      navigate("Risk Forecast");
                      setNotifications(false);
                    }}
                  >
                    Open Risk Forecast <Icon name="arrow" size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="popover-anchor">
          <button
            className="avatar"
            aria-label="Open workspace menu"
            aria-expanded={profile}
            onClick={() => {
              setProfile(!profile);
              setNotifications(false);
            }}
          >
            <Icon name="settings" size={16} />
          </button>
          {profile && (
            <div className="popover profile-popover">
              <strong>OrbitBurn workspace</strong>
              <span>{API_URL}</span>
              <hr />
              <button
                onClick={() => {
                  navigate("Settings");
                  setProfile(false);
                }}
              >
                <Icon name="settings" size={15} /> Workspace preferences
              </button>
              <button
                onClick={() => {
                  onOpenInfo();
                  setProfile(false);
                }}
              >
                <Icon name="info" size={15} /> About OrbitBurn
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

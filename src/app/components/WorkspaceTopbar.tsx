import type { Dispatch, SetStateAction } from "react";
import { getObservation } from "../../features/history/demo/demo-data";
import { REGION_FACTORS } from "../../features/history/demo/region-factors";
import { PreventiveNotifications } from "../../features/prevention-demo/components";
import type { PreventionController } from "../../features/prevention-demo/usePrevention";
import { Dot, Icon } from "../../shared/ui/ui";
import { type WorkspacePage } from "../navigation";
export default function WorkspaceTopbar({
  page,
  notifications,
  setNotifications,
  profile,
  setProfile,
  alertsEnabled,
  prevention,
  openPreventiveAlert,
  navigate,
  setRegion,
  onOpenInfo,
  onOpenMenu,
}: {
  page: WorkspacePage;
  notifications: boolean;
  setNotifications: Dispatch<SetStateAction<boolean>>;
  profile: boolean;
  setProfile: Dispatch<SetStateAction<boolean>>;
  alertsEnabled: boolean;
  prevention: PreventionController;
  openPreventiveAlert: (id: string) => void;
  navigate: (page: WorkspacePage) => void;
  setRegion: (region: string) => void;
  onOpenInfo: () => void;
  onOpenMenu: () => void;
}) {
  const unreadAlertCount = prevention.alerts.filter(
    (alert) => alert.readStatus === "unread",
  ).length;
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
        <span className="environment">
          <Dot color="orange" /> Demo environment
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
            {alertsEnabled && unreadAlertCount > 0 && (
              <span
                className="preventive-unread-count"
                aria-label={`${unreadAlertCount} unread preventive alerts`}
              >
                {unreadAlertCount}
              </span>
            )}
          </button>
          {notifications && (
            <div className="popover notifications-popover">
              {alertsEnabled ? (
                <PreventiveNotifications
                  controller={prevention}
                  onOpen={openPreventiveAlert}
                  onCenter={() => navigate("Alert Center")}
                />
              ) : (
                <div className="empty-state">
                  Notification previews are disabled in Settings. Supplied records remain available
                  in the Alert Center.
                </div>
              )}
              <details className="observation-demo-notice">
                <summary>Observation demonstration notice</summary>
                {alertsEnabled ? (
                  <div className="notification-item">
                    <span className="notification-icon">
                      <Icon name="alert" />
                    </span>
                    <div>
                      <strong>Elevated activity in South America</strong>
                      <p>
                        Illustrative 24-hour snapshot: detections are{" "}
                        {
                          getObservation("Last 24 hours", REGION_FACTORS["South America"]).changes
                            .total
                        }{" "}
                        versus the preceding 24 hours. This alert is independent of the selected
                        observation window.
                      </p>
                      <button
                        className="text-link"
                        onClick={() => {
                          setRegion("South America");
                          navigate("Fire Map");
                          setNotifications(false);
                        }}
                      >
                        Explore region <Icon name="arrow" size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    Demo notifications are disabled. Enable them in Settings.
                  </div>
                )}
                <div className="notification-foot">Simulated observation notice · Aug 24, 2026</div>
              </details>
            </div>
          )}
        </div>
        <div className="popover-anchor">
          <button
            className="avatar"
            aria-label="Open profile menu"
            aria-expanded={profile}
            onClick={() => {
              setProfile(!profile);
              setNotifications(false);
            }}
          >
            AC
          </button>
          {profile && (
            <div className="popover profile-popover">
              <strong>Alex Carter</strong>
              <span>Researcher · Demo workspace</span>
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

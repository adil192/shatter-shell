/** The ID of a monitor in the display server. */
type MonitorID = number & { readonly __type: unique symbol };

/** The ID of a workspace in GNOME Shell */
type WorkspaceID = number & { readonly __type: unique symbol };;

type MonitorWorkspaceID = [monitor: MonitorID, workspace: WorkspaceID];

type SignalID = number;

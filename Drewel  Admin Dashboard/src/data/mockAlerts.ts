// ─── Alert types ─────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning";
export type AlertStatus   = "open" | "acknowledged" | "resolved";

export type AlertType =
  | "stuck_ride"
  | "stale_driver_location"
  | "driver_busy_no_active_ride"
  | "multiple_active_rides"
  | "inconsistent_points"
  | "expired_point_reservation"
  | "google_routes_failure"
  | "socketio_interruption"
  | "repeated_pin_failures"
  | "expiring_driver_documents";

export interface AlertEntity {
  type: "ride" | "driver" | "user" | "system";
  id: string;
  label: string;
  path: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  alertType: AlertType;
  title: string;
  description: string;
  entity: AlertEntity | null;
  secondaryEntity: AlertEntity | null;
  assignedAdmin: string | null;
  createdAt: string;
  status: AlertStatus;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

// ─── Type metadata ─────────────────────────────────────────────────────────────

export const ALERT_TYPE_META: Record<AlertType, { label: string; category: string }> = {
  stuck_ride:                  { label: "Stuck Ride",                  category: "Operations" },
  stale_driver_location:       { label: "Stale Driver Location",       category: "Operations" },
  driver_busy_no_active_ride:  { label: "Driver Busy / No Active Ride",category: "Operations" },
  multiple_active_rides:       { label: "Multiple Active Rides",       category: "Operations" },
  inconsistent_points:         { label: "Inconsistent Points",         category: "Points"     },
  expired_point_reservation:   { label: "Expired Reservation",         category: "Points"     },
  google_routes_failure:       { label: "Google Routes Failure",       category: "System"     },
  socketio_interruption:       { label: "Socket.IO Interruption",      category: "System"     },
  repeated_pin_failures:       { label: "Repeated PIN Failures",       category: "Security"   },
  expiring_driver_documents:   { label: "Expiring Documents",          category: "Compliance" },
};

// ─── Mock data ─────────────────────────────────────────────────────────────────

const T = (offsetMinutes: number) =>
  new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString();

export const mockAlertsList: Alert[] = [
  // Critical — Open
  {
    id: "ALT-0811",
    severity: "critical",
    alertType: "stuck_ride",
    title: "Ride RDE-88265 stuck In Progress for 5h 12m",
    description: "RDE-88265 entered 'ride_started' at 03:10 and has not progressed. Driver GPS has been stale for 4h 29m. Possible app crash or connectivity loss.",
    entity: { type: "ride", id: "RDE-88265", label: "RDE-88265", path: "/rides/live?selected=RDE-88265" },
    secondaryEntity: { type: "driver", id: "DRV-4421", label: "Marcus Oyelaran", path: "/drivers?id=DRV-4421" },
    assignedAdmin: null,
    createdAt: T(312),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0810",
    severity: "critical",
    alertType: "stale_driver_location",
    title: "Driver DRV-4421 GPS stale for 4h 29m during active ride",
    description: "Marcus Oyelaran's last GPS update was 4h 29m ago while ride RDE-88265 is In Progress. Route estimation is disabled until location updates resume.",
    entity: { type: "driver", id: "DRV-4421", label: "Marcus Oyelaran", path: "/drivers?id=DRV-4421" },
    secondaryEntity: { type: "ride", id: "RDE-88265", label: "RDE-88265", path: "/rides/live?selected=RDE-88265" },
    assignedAdmin: null,
    createdAt: T(269),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0809",
    severity: "critical",
    alertType: "multiple_active_rides",
    title: "Driver DRV-3301 has 2 concurrent active rides",
    description: "DRV-3301 (Yusuf Musa) appears as driver on both RDE-88291 (ride_started) and RDE-88289 (driver_on_way). One assignment is likely erroneous. Points reserved on both rides.",
    entity: { type: "driver", id: "DRV-3301", label: "Yusuf Musa", path: "/drivers?id=DRV-3301" },
    secondaryEntity: { type: "ride", id: "RDE-88291", label: "RDE-88291", path: "/rides/all" },
    assignedAdmin: "S. Chen",
    createdAt: T(48),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0808",
    severity: "critical",
    alertType: "inconsistent_points",
    title: "Driver DRV-2908 point balance is negative: −4 pts",
    description: "Fatima Al-Rashidi's confirmed available balance is −4 points after transaction TXN-14928. A refund or correction is required before the driver can accept new rides.",
    entity: { type: "driver", id: "DRV-2908", label: "Fatima Al-Rashidi", path: "/drivers?id=DRV-2908" },
    secondaryEntity: null,
    assignedAdmin: null,
    createdAt: T(22),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0807",
    severity: "critical",
    alertType: "socketio_interruption",
    title: "Socket.IO cluster node ws-02 disconnected",
    description: "WebSocket node ws-02 lost heartbeat at 09:41. 63 active connections were migrated to ws-01 and ws-03. Dispatch latency elevated by ~180ms. Investigation in progress.",
    entity: { type: "system", id: "ws-02", label: "Socket.IO ws-02", path: "/system-health" },
    secondaryEntity: null,
    assignedAdmin: "T. Okonkwo",
    createdAt: T(14),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },

  // Warning — Open
  {
    id: "ALT-0806",
    severity: "warning",
    alertType: "driver_busy_no_active_ride",
    title: "Driver DRV-5102 marked Busy without an active ride",
    description: "Emeka Chukwuemeka has status 'online_busy' but no ride is currently assigned to DRV-5102. Driver may be in an orphaned state and unavailable for new offers.",
    entity: { type: "driver", id: "DRV-5102", label: "Emeka Chukwuemeka", path: "/drivers?id=DRV-5102" },
    secondaryEntity: null,
    assignedAdmin: null,
    createdAt: T(37),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0805",
    severity: "warning",
    alertType: "expired_point_reservation",
    title: "Point reservation RESV-4421-14 expired on ride RDE-88199",
    description: "Reservation of 12 pts for ride RDE-88199 expired at 08:55 without being claimed or released. Ride status is 'completed'. Points may be double-counted in driver balance.",
    entity: { type: "ride", id: "RDE-88199", label: "RDE-88199", path: "/rides/all" },
    secondaryEntity: { type: "driver", id: "DRV-4421", label: "Marcus Oyelaran", path: "/drivers?id=DRV-4421" },
    assignedAdmin: "R. Nakamura",
    createdAt: T(95),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0804",
    severity: "warning",
    alertType: "google_routes_failure",
    title: "Google Routes API errors — 6 failed in last 30m",
    description: "6 route calculations failed with HTTP 503 between 09:12 and 09:41. Rides affected proceeded without ETA. API quota at 94%. Check for regional outage on GCP status page.",
    entity: { type: "system", id: "google-routes", label: "Google Routes API", path: "/system-health" },
    secondaryEntity: null,
    assignedAdmin: null,
    createdAt: T(19),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0803",
    severity: "warning",
    alertType: "repeated_pin_failures",
    title: "5 consecutive pickup PIN failures on ride RDE-88301",
    description: "Passenger Temi Afolabi (USR-10021) has failed pickup PIN confirmation 5 times on RDE-88301 in the last 8 minutes. Possible fraud attempt or passenger identity mismatch.",
    entity: { type: "ride", id: "RDE-88301", label: "RDE-88301", path: "/rides/live?selected=RDE-88301" },
    secondaryEntity: { type: "user", id: "USR-10021", label: "Temi Afolabi", path: "/users?id=USR-10021" },
    assignedAdmin: null,
    createdAt: T(9),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0802",
    severity: "warning",
    alertType: "expiring_driver_documents",
    title: "3 drivers have documents expiring within 14 days",
    description: "Motor Insurance for DRV-2908 expires in 3 days. Vehicle Registration for DRV-6031 expires in 8 days. Driver's License for DRV-7204 expires in 12 days. All require renewal before expiry.",
    entity: null,
    secondaryEntity: null,
    assignedAdmin: null,
    createdAt: T(420),
    status: "open",
    acknowledgedAt: null, acknowledgedBy: null,
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },

  // Acknowledged
  {
    id: "ALT-0801",
    severity: "warning",
    alertType: "stale_driver_location",
    title: "Driver DRV-6031 GPS stale for 22 minutes",
    description: "GPS for Ade Bello last updated 22m ago. Ride RDE-88271 is active. Location stream may have paused due to background restriction on device.",
    entity: { type: "driver", id: "DRV-6031", label: "Ade Bello", path: "/drivers?id=DRV-6031" },
    secondaryEntity: { type: "ride", id: "RDE-88271", label: "RDE-88271", path: "/rides/live?selected=RDE-88271" },
    assignedAdmin: "S. Chen",
    createdAt: T(35),
    status: "acknowledged",
    acknowledgedAt: T(28), acknowledgedBy: "S. Chen",
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },
  {
    id: "ALT-0800",
    severity: "warning",
    alertType: "expired_point_reservation",
    title: "Point reservation RESV-5102-08 expired without claim",
    description: "Reservation of 8 pts on ride RDE-88215 (completed) was not released. Created 3h ago, no claim transaction found.",
    entity: { type: "driver", id: "DRV-5102", label: "Emeka Chukwuemeka", path: "/drivers?id=DRV-5102" },
    secondaryEntity: null,
    assignedAdmin: "R. Nakamura",
    createdAt: T(190),
    status: "acknowledged",
    acknowledgedAt: T(150), acknowledgedBy: "R. Nakamura",
    resolvedAt: null, resolvedBy: null, resolutionNote: null,
  },

  // Resolved
  {
    id: "ALT-0799",
    severity: "warning",
    alertType: "google_routes_failure",
    title: "Google Routes API 503 — 2 affected offers",
    description: "2 ride offers at 06:14 received no route data due to a transient 503. ETA was omitted; offers proceeded normally.",
    entity: { type: "system", id: "google-routes", label: "Google Routes API", path: "/system-health" },
    secondaryEntity: null,
    assignedAdmin: "S. Chen",
    createdAt: T(240),
    status: "resolved",
    acknowledgedAt: T(225), acknowledgedBy: "S. Chen",
    resolvedAt: T(180), resolvedBy: "S. Chen",
    resolutionNote: "Confirmed transient GCP outage in us-central1. Monitoring restored at 06:45. No data loss.",
  },
  {
    id: "ALT-0798",
    severity: "critical",
    alertType: "stuck_ride",
    title: "Ride RDE-88201 stuck driver_arrived for 35m",
    description: "Passenger did not confirm pickup within expected window. Driver contacted via in-app — confirmed passenger cancelled verbally. Ride force-cancelled by admin.",
    entity: { type: "ride", id: "RDE-88201", label: "RDE-88201", path: "/rides/all" },
    secondaryEntity: null,
    assignedAdmin: "J. Kowalski",
    createdAt: T(380),
    status: "resolved",
    acknowledgedAt: T(360), acknowledgedBy: "J. Kowalski",
    resolvedAt: T(340), resolvedBy: "J. Kowalski",
    resolutionNote: "Passenger no-show confirmed. Ride cancelled by admin. Driver compensated 3 pts for wait time.",
  },
];

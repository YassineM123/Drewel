export type NotificationCategory =
  | "critical_alert"
  | "point_request"
  | "verification_request"
  | "new_dispute"
  | "stuck_ride"
  | "system_incident";

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  relatedPath: string | null;
  relatedLabel: string | null;
  relatedId: string | null;
}

const T = (offsetMinutes: number) =>
  new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString();

export const CATEGORY_META: Record<NotificationCategory, { label: string; color: string; dot: string }> = {
  critical_alert:        { label: "Critical Alert",        color: "text-red-700 bg-red-50 border-red-200",       dot: "bg-red-500"    },
  point_request:         { label: "Point Request",         color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500"  },
  verification_request:  { label: "Verification",          color: "text-blue-700 bg-blue-50 border-blue-200",    dot: "bg-blue-500"   },
  new_dispute:           { label: "New Dispute",           color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  stuck_ride:            { label: "Stuck Ride",            color: "text-rose-700 bg-rose-50 border-rose-200",    dot: "bg-rose-500"   },
  system_incident:       { label: "System Incident",       color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-500" },
};

export const mockNotifications: Notification[] = [
  {
    id: "NTF-201",
    category: "critical_alert",
    title: "Critical: Socket.IO node ws-02 disconnected",
    body: "WebSocket cluster node ws-02 lost heartbeat. 63 connections migrated.",
    createdAt: T(14),
    readAt: null,
    relatedPath: "/system-health",
    relatedLabel: "System Health",
    relatedId: "ALT-0807",
  },
  {
    id: "NTF-200",
    category: "critical_alert",
    title: "Critical: Ride RDE-88265 stuck for 5h+",
    body: "RDE-88265 has been In Progress since 03:10. Driver GPS stale for 4h 29m.",
    createdAt: T(22),
    readAt: null,
    relatedPath: "/rides/live?selected=RDE-88265",
    relatedLabel: "RDE-88265",
    relatedId: "ALT-0811",
  },
  {
    id: "NTF-199",
    category: "stuck_ride",
    title: "Stuck: RDE-88291 driver_on_way for 48m",
    body: "Driver Yusuf Musa (DRV-3301) has not reached pickup after 48 minutes.",
    createdAt: T(48),
    readAt: null,
    relatedPath: "/rides/stuck",
    relatedLabel: "Stuck Rides",
    relatedId: "RDE-88291",
  },
  {
    id: "NTF-198",
    category: "new_dispute",
    title: "New dispute DSP-3042 — Overcharge",
    body: "Dauda Abubakar filed a dispute on RDE-88305. Claimed fare ₦6,200, actual ₦4,400.",
    createdAt: T(31),
    readAt: null,
    relatedPath: "/rides/disputes",
    relatedLabel: "DSP-3042",
    relatedId: "DSP-3042",
  },
  {
    id: "NTF-197",
    category: "verification_request",
    title: "VRQ-2024-0892 awaiting Approval 1",
    body: "New driver verification request for Chidi Okafor — 4 documents submitted.",
    createdAt: T(55),
    readAt: null,
    relatedPath: "/verification",
    relatedLabel: "VRQ-2024-0892",
    relatedId: "VRQ-2024-0892",
  },
  {
    id: "NTF-196",
    category: "point_request",
    title: "Point request REQ-502 — 150 pts",
    body: "Marcus Oyelaran (DRV-4421) requesting 150 points purchase. Amount: ₦15,000.",
    createdAt: T(72),
    readAt: null,
    relatedPath: "/points/requests",
    relatedLabel: "REQ-502",
    relatedId: "REQ-502",
  },
  {
    id: "NTF-195",
    category: "system_incident",
    title: "INC-0041: Driver Location API latency elevated",
    body: "P95 latency at 480ms vs 120ms baseline. Engineering investigating.",
    createdAt: T(120),
    readAt: null,
    relatedPath: "/system-health",
    relatedLabel: "INC-0041",
    relatedId: "INC-0041",
  },
  {
    id: "NTF-194",
    category: "verification_request",
    title: "VRQ-2024-0890 SLA breached — 4.8h",
    body: "Adaeze Nwosu document update request is overdue. Assigned to S. Chen.",
    createdAt: T(180),
    readAt: T(165),
    relatedPath: "/verification",
    relatedLabel: "VRQ-2024-0890",
    relatedId: "VRQ-2024-0890",
  },
  {
    id: "NTF-193",
    category: "point_request",
    title: "Point request REQ-501 — 200 pts",
    body: "Adaeze Nwosu (DRV-3814) requesting 200 points. Awaiting approval.",
    createdAt: T(210),
    readAt: T(200),
    relatedPath: "/points/requests",
    relatedLabel: "REQ-501",
    relatedId: "REQ-501",
  },
  {
    id: "NTF-192",
    category: "new_dispute",
    title: "Dispute DSP-3041 escalated — Safety concern",
    body: "Olamide Hassan (USR-10019) reports safety issue during ride RDE-88100.",
    createdAt: T(320),
    readAt: T(310),
    relatedPath: "/rides/disputes",
    relatedLabel: "DSP-3041",
    relatedId: "DSP-3041",
  },
  {
    id: "NTF-191",
    category: "stuck_ride",
    title: "Stuck ride resolved: RDE-88201",
    body: "Admin J. Kowalski resolved stuck ride RDE-88201. Driver compensated.",
    createdAt: T(340),
    readAt: T(330),
    relatedPath: "/rides/all",
    relatedLabel: "RDE-88201",
    relatedId: "RDE-88201",
  },
  {
    id: "NTF-190",
    category: "system_incident",
    title: "INC-0040 resolved — Notification delays",
    body: "Lagos push notification delays resolved. All queued messages delivered.",
    createdAt: T(480),
    readAt: T(460),
    relatedPath: "/system-health",
    relatedLabel: "INC-0040",
    relatedId: "INC-0040",
  },
];

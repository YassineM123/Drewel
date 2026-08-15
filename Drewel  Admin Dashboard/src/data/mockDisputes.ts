import type { RideStatus } from "./mockRides";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisputeStatus =
  | "open"
  | "under_review"
  | "waiting_user"
  | "waiting_driver"
  | "resolved"
  | "rejected";

export type DisputePriority = "critical" | "high" | "medium" | "low";

export type DisputeReason =
  | "overcharge"
  | "route_deviation"
  | "driver_misconduct"
  | "no_show"
  | "safety_concern"
  | "payment_issue"
  | "app_malfunction"
  | "driver_cancelled"
  | "trip_not_completed";

export type ResolutionDecision = "driver" | "user" | "split" | "rejected";

export interface DisputeNote {
  id: string;
  text: string;
  author: string;
  at: string;
  type?: "note" | "action" | "system";
}

export interface Dispute {
  id: string;
  rideId: string;
  reportedBy: "user" | "driver" | "system" | "admin";
  user: { id: string; name: string; avatar: string; phone: string };
  driver: { id: string; name: string; avatar: string; phone: string };
  reason: DisputeReason;
  rideStatus: RideStatus;
  pointsInvolved: number;
  amountNGN: number;
  priority: DisputePriority;
  assignedAdmin: string | null;
  createdAt: string;
  updatedAt: string;
  status: DisputeStatus;
  userStatement: string;
  driverStatement: string | null;
  internalNotes: DisputeNote[];
  chatEvidence: boolean;
  callEvidence: boolean;
  callDuration?: number;
  resolution: {
    decision: ResolutionDecision;
    reason: string;
    at: string;
    by: string;
    pointsRefunded?: number;
  } | null;
  auditRefs: string[];
  city: string;
  vehicleType: "sedan" | "suv" | "premium";
  ridePickup: string;
  rideDestination: string;
  rideDistanceKm: number;
  rideDurationMin: number;
  rideTimeline: { status: RideStatus; at: string; actor: string }[];
  pointsTransactions: {
    id: string;
    type: string;
    amount: number;
    at: string;
    actor: string;
    note: string;
  }[];
  previousAdminActions: {
    id: string;
    action: string;
    by: string;
    at: string;
    note: string;
  }[];
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const mockDisputes: Dispute[] = [
  // ── Critical open: safety concern ──
  {
    id: "DSP-3041",
    rideId: "RDE-88290",
    reportedBy: "user",
    user: { id: "USR-10031", name: "Amaka Okoye", avatar: "AO", phone: "+234 812 345 6789" },
    driver: { id: "DRV-5108", name: "Babatunde Rasheed", avatar: "BR", phone: "+234 803 456 7890" },
    reason: "safety_concern",
    rideStatus: "completed",
    pointsInvolved: 75,
    amountNGN: 6800,
    priority: "critical",
    assignedAdmin: null,
    createdAt: "2024-07-14T06:10:00Z",
    updatedAt: "2024-07-14T06:10:00Z",
    status: "open",
    userStatement: "The driver took a completely different route than the app showed, drove through unlit streets I didn't recognise, and when I asked him to stop he became verbally aggressive. I felt unsafe the entire last 10 minutes of the trip. I want a full refund and I believe this driver should be investigated.",
    driverStatement: null,
    internalNotes: [],
    chatEvidence: true,
    callEvidence: false,
    resolution: null,
    auditRefs: [],
    city: "Lagos",
    vehicleType: "sedan",
    ridePickup: "Ikeja City Mall, Obafemi Awolowo Way",
    rideDestination: "Chevron Drive, Lekki",
    rideDistanceKm: 22.4,
    rideDurationMin: 68,
    rideTimeline: [
      { status: "offer_sent", at: "2024-07-14T04:45:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-14T04:45:40Z", actor: "Babatunde Rasheed" },
      { status: "driver_on_way", at: "2024-07-14T04:46:00Z", actor: "System" },
      { status: "driver_arrived", at: "2024-07-14T04:58:00Z", actor: "Babatunde Rasheed" },
      { status: "pickup_confirmed", at: "2024-07-14T04:59:30Z", actor: "Amaka Okoye" },
      { status: "ride_started", at: "2024-07-14T05:00:00Z", actor: "System" },
      { status: "completed", at: "2024-07-14T06:08:00Z", actor: "System" },
    ],
    pointsTransactions: [
      { id: "PTX-9001", type: "offer_reservation", amount: -75, at: "2024-07-14T04:45:00Z", actor: "System", note: "Reserved for offer OFF-44097" },
      { id: "PTX-9002", type: "ride_debit", amount: -75, at: "2024-07-14T06:08:10Z", actor: "System", note: "Ride completed — points debited" },
    ],
    previousAdminActions: [],
  },

  // ── High open: overcharge ──
  {
    id: "DSP-3039",
    rideId: "RDE-88278",
    reportedBy: "user",
    user: { id: "USR-10028", name: "Kola Adewale", avatar: "KA", phone: "+234 807 234 5678" },
    driver: { id: "DRV-1823", name: "Olumide Adebayo", avatar: "OA", phone: "+234 804 567 8901" },
    reason: "overcharge",
    rideStatus: "completed",
    pointsInvolved: 110,
    amountNGN: 9900,
    priority: "high",
    assignedAdmin: "Sarah Eze",
    createdAt: "2024-07-13T16:22:00Z",
    updatedAt: "2024-07-13T17:05:00Z",
    status: "under_review",
    userStatement: "The app quoted me ₦4,500 before I confirmed the ride but my account was charged ₦9,900 and 110 points. The driver said there was a surge but the app never showed any surge indicator. I want a refund of the difference.",
    driverStatement: "There was peak hour surge pricing active at the time. My app showed surge 2.2x clearly. I completed the ride as requested. The charge is correct according to the system.",
    internalNotes: [
      { id: "N1", text: "Pulled pricing logs — surge was active at 1.8x, not 2.2x. Overage of approximately ₦1,800.", author: "Sarah Eze", at: "2024-07-13T17:05:00Z", type: "note" },
    ],
    chatEvidence: true,
    callEvidence: false,
    resolution: null,
    auditRefs: [],
    city: "Lagos",
    vehicleType: "suv",
    ridePickup: "Lekki Phase 1, Admiralty Way",
    rideDestination: "Victoria Island, Adeola Odeku Street",
    rideDistanceKm: 8.7,
    rideDurationMin: 34,
    rideTimeline: [
      { status: "offer_sent", at: "2024-07-13T15:30:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-13T15:30:55Z", actor: "Olumide Adebayo" },
      { status: "driver_on_way", at: "2024-07-13T15:31:10Z", actor: "System" },
      { status: "driver_arrived", at: "2024-07-13T15:42:00Z", actor: "Olumide Adebayo" },
      { status: "pickup_confirmed", at: "2024-07-13T15:43:00Z", actor: "Kola Adewale" },
      { status: "ride_started", at: "2024-07-13T15:43:30Z", actor: "System" },
      { status: "completed", at: "2024-07-13T16:17:30Z", actor: "System" },
    ],
    pointsTransactions: [
      { id: "PTX-9003", type: "offer_reservation", amount: -110, at: "2024-07-13T15:30:00Z", actor: "System", note: "Reserved for offer OFF-44082" },
      { id: "PTX-9004", type: "ride_debit", amount: -110, at: "2024-07-13T16:17:35Z", actor: "System", note: "Ride completed — points debited" },
    ],
    previousAdminActions: [
      { id: "ACT-1", action: "assign_admin", by: "Mohammed Ibrahim", at: "2024-07-13T16:45:00Z", note: "Assigned to Sarah Eze for review" },
    ],
  },

  // ── High under_review: route deviation ──
  {
    id: "DSP-3038",
    rideId: "RDE-88271",
    reportedBy: "user",
    user: { id: "USR-10019", name: "Fatimah Bello", avatar: "FB", phone: "+234 809 876 5432" },
    driver: { id: "DRV-5102", name: "Emeka Chukwuemeka", avatar: "EC", phone: "+234 805 678 9012" },
    reason: "route_deviation",
    rideStatus: "completed",
    pointsInvolved: 55,
    amountNGN: 4200,
    priority: "high",
    assignedAdmin: "Tobi Olatunji",
    createdAt: "2024-07-13T09:14:00Z",
    updatedAt: "2024-07-14T07:30:00Z",
    status: "waiting_driver",
    userStatement: "The driver added at least 6 km by not taking the Third Mainland Bridge as the app suggested. I have screenshots of the GPS trail showing the detour. This inflated both my time and cost.",
    driverStatement: "The Third Mainland Bridge had a police checkpoint causing major delays at that time. I rerouted through Carter Bridge which is standard practice. I did not benefit financially from the longer distance — the fare was fixed.",
    internalNotes: [
      { id: "N2", text: "Requested GPS logs from engineering. Awaiting response.", author: "Tobi Olatunji", at: "2024-07-13T10:00:00Z", type: "note" },
      { id: "N3", text: "GPS logs received. Route deviation confirmed — extra 5.8 km vs optimal route. Driver did not notify user of reroute.", author: "Tobi Olatunji", at: "2024-07-14T07:30:00Z", type: "action" },
    ],
    chatEvidence: true,
    callEvidence: false,
    resolution: null,
    auditRefs: [],
    city: "Lagos",
    vehicleType: "sedan",
    ridePickup: "Surulere, Adeniran Ogunsanya Street",
    rideDestination: "Lagos Island, Marina",
    rideDistanceKm: 14.2,
    rideDurationMin: 52,
    rideTimeline: [
      { status: "offer_sent", at: "2024-07-13T08:20:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-13T08:20:45Z", actor: "Emeka Chukwuemeka" },
      { status: "driver_on_way", at: "2024-07-13T08:21:00Z", actor: "System" },
      { status: "driver_arrived", at: "2024-07-13T08:31:00Z", actor: "Emeka Chukwuemeka" },
      { status: "pickup_confirmed", at: "2024-07-13T08:32:30Z", actor: "Fatimah Bello" },
      { status: "ride_started", at: "2024-07-13T08:33:00Z", actor: "System" },
      { status: "completed", at: "2024-07-13T09:25:00Z", actor: "System" },
    ],
    pointsTransactions: [
      { id: "PTX-9005", type: "offer_reservation", amount: -55, at: "2024-07-13T08:20:00Z", actor: "System", note: "Reserved for offer OFF-44074" },
      { id: "PTX-9006", type: "ride_debit", amount: -55, at: "2024-07-13T09:25:05Z", actor: "System", note: "Ride completed — points debited" },
    ],
    previousAdminActions: [
      { id: "ACT-2", action: "request_info", by: "Tobi Olatunji", at: "2024-07-13T10:00:00Z", note: "Requested driver statement and GPS logs" },
      { id: "ACT-3", action: "assign_admin", by: "Mohammed Ibrahim", at: "2024-07-13T09:30:00Z", note: "Assigned to Tobi Olatunji" },
    ],
  },

  // ── Medium waiting_user: no show ──
  {
    id: "DSP-3035",
    rideId: "RDE-88255",
    reportedBy: "user",
    user: { id: "USR-10012", name: "Blessing Nwosu", avatar: "BN", phone: "+234 816 543 2109" },
    driver: { id: "DRV-3391", name: "Akin Ogundimu", avatar: "AG", phone: "+234 808 765 4321" },
    reason: "no_show",
    rideStatus: "cancelled_driver",
    pointsInvolved: 30,
    amountNGN: 0,
    priority: "medium",
    assignedAdmin: "Sarah Eze",
    createdAt: "2024-07-12T14:05:00Z",
    updatedAt: "2024-07-13T09:10:00Z",
    status: "waiting_user",
    userStatement: "The driver accepted my ride, I waited 18 minutes at the pickup location. He never arrived and then cancelled on me. I was late for a meeting.",
    driverStatement: "I arrived at the location and waited 5 minutes. The passenger was not there and was not responding to my calls through the app. I had to cancel to avoid further delays.",
    internalNotes: [
      { id: "N4", text: "Call logs confirm driver made 2 in-app calls at 14:08 and 14:11. User did not answer. Requested user to confirm their account of events.", author: "Sarah Eze", at: "2024-07-13T09:10:00Z", type: "action" },
    ],
    chatEvidence: false,
    callEvidence: true,
    callDuration: 0,
    resolution: null,
    auditRefs: [],
    city: "Lagos",
    vehicleType: "sedan",
    ridePickup: "Yaba, Herbert Macaulay Way",
    rideDestination: "Oshodi, International Airport Road",
    rideDistanceKm: 7.1,
    rideDurationMin: 0,
    rideTimeline: [
      { status: "offer_sent", at: "2024-07-12T13:50:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-12T13:51:00Z", actor: "Akin Ogundimu" },
      { status: "driver_on_way", at: "2024-07-12T13:51:30Z", actor: "System" },
      { status: "cancelled_driver", at: "2024-07-12T14:14:00Z", actor: "Akin Ogundimu" },
    ],
    pointsTransactions: [
      { id: "PTX-9007", type: "offer_reservation", amount: -30, at: "2024-07-12T13:50:00Z", actor: "System", note: "Reserved for offer OFF-44058" },
      { id: "PTX-9008", type: "reservation_release", amount: 30, at: "2024-07-12T14:14:05Z", actor: "System", note: "Reservation released on driver cancellation" },
    ],
    previousAdminActions: [
      { id: "ACT-4", action: "request_info", by: "Sarah Eze", at: "2024-07-13T09:10:00Z", note: "Requested user to clarify whether they were at the pickup location" },
    ],
  },

  // ── Medium open: payment issue ──
  {
    id: "DSP-3034",
    rideId: "RDE-88248",
    reportedBy: "system",
    user: { id: "USR-10008", name: "Taiwo Adeleke", avatar: "TA", phone: "+234 811 987 6543" },
    driver: { id: "DRV-2244", name: "Uche Nnamdi", avatar: "UN", phone: "+234 802 345 6789" },
    reason: "payment_issue",
    rideStatus: "completed",
    pointsInvolved: 95,
    amountNGN: 8500,
    priority: "medium",
    assignedAdmin: null,
    createdAt: "2024-07-13T22:01:00Z",
    updatedAt: "2024-07-13T22:01:00Z",
    status: "open",
    userStatement: "System auto-flagged: points deducted twice for the same ride. User balance shows -190 points for a single trip.",
    driverStatement: null,
    internalNotes: [],
    chatEvidence: false,
    callEvidence: false,
    resolution: null,
    auditRefs: [],
    city: "Abuja",
    vehicleType: "sedan",
    ridePickup: "Wuse 2, Aminu Kano Crescent",
    rideDestination: "Maitama, Adetokunbo Ademola Crescent",
    rideDistanceKm: 5.3,
    rideDurationMin: 22,
    rideTimeline: [
      { status: "offer_sent", at: "2024-07-13T21:00:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-13T21:00:50Z", actor: "Uche Nnamdi" },
      { status: "driver_on_way", at: "2024-07-13T21:01:10Z", actor: "System" },
      { status: "driver_arrived", at: "2024-07-13T21:09:00Z", actor: "Uche Nnamdi" },
      { status: "pickup_confirmed", at: "2024-07-13T21:10:00Z", actor: "Taiwo Adeleke" },
      { status: "ride_started", at: "2024-07-13T21:10:30Z", actor: "System" },
      { status: "completed", at: "2024-07-13T21:32:30Z", actor: "System" },
    ],
    pointsTransactions: [
      { id: "PTX-9009", type: "offer_reservation", amount: -95, at: "2024-07-13T21:00:00Z", actor: "System", note: "Reserved for offer OFF-44045" },
      { id: "PTX-9010", type: "ride_debit", amount: -95, at: "2024-07-13T21:32:35Z", actor: "System", note: "Ride completed — points debited" },
      { id: "PTX-9011", type: "ride_debit", amount: -95, at: "2024-07-13T21:32:48Z", actor: "System", note: "DUPLICATE — points debited (retry error)" },
    ],
    previousAdminActions: [],
  },

  // ── Low resolved: driver misconduct ──
  {
    id: "DSP-3030",
    rideId: "RDE-88220",
    reportedBy: "user",
    user: { id: "USR-10002", name: "Chisom Eze", avatar: "CE", phone: "+234 815 678 9012" },
    driver: { id: "DRV-4477", name: "Seun Babatunde", avatar: "SB", phone: "+234 806 789 0123" },
    reason: "driver_misconduct",
    rideStatus: "completed",
    pointsInvolved: 45,
    amountNGN: 3600,
    priority: "low",
    assignedAdmin: "Tobi Olatunji",
    createdAt: "2024-07-11T11:30:00Z",
    updatedAt: "2024-07-12T15:20:00Z",
    status: "resolved",
    userStatement: "Driver was rude and refused to play any music despite me politely asking. He also made a personal phone call for most of the journey.",
    driverStatement: "I was not aware of passenger expectations around music. I apologise for the phone call — it was an emergency. I believe I completed the ride safely.",
    internalNotes: [
      { id: "N5", text: "Reviewed chat history — no evidence of aggressive conduct, behavioural issue only. Recommending partial refund (20%) as goodwill.", author: "Tobi Olatunji", at: "2024-07-12T15:00:00Z", type: "note" },
      { id: "N6", text: "Partial refund of 9 points issued. Driver issued a formal courtesy reminder.", author: "Tobi Olatunji", at: "2024-07-12T15:20:00Z", type: "action" },
    ],
    chatEvidence: true,
    callEvidence: false,
    resolution: {
      decision: "user",
      reason: "Driver conduct fell below expected standard. 20% goodwill refund issued. Driver cautioned.",
      at: "2024-07-12T15:20:00Z",
      by: "Tobi Olatunji",
      pointsRefunded: 9,
    },
    auditRefs: ["AUD-3301", "AUD-3302"],
    city: "Lagos",
    vehicleType: "sedan",
    ridePickup: "Ikeja, Allen Avenue",
    rideDestination: "Magodo, CMD Road",
    rideDistanceKm: 9.4,
    rideDurationMin: 38,
    rideTimeline: [
      { status: "offer_sent", at: "2024-07-11T10:45:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-11T10:45:50Z", actor: "Seun Babatunde" },
      { status: "driver_on_way", at: "2024-07-11T10:46:10Z", actor: "System" },
      { status: "driver_arrived", at: "2024-07-11T10:55:00Z", actor: "Seun Babatunde" },
      { status: "pickup_confirmed", at: "2024-07-11T10:56:00Z", actor: "Chisom Eze" },
      { status: "ride_started", at: "2024-07-11T10:56:30Z", actor: "System" },
      { status: "completed", at: "2024-07-11T11:34:30Z", actor: "System" },
    ],
    pointsTransactions: [
      { id: "PTX-9013", type: "offer_reservation", amount: -45, at: "2024-07-11T10:45:00Z", actor: "System", note: "Reserved for offer OFF-44015" },
      { id: "PTX-9014", type: "ride_debit", amount: -45, at: "2024-07-11T11:34:35Z", actor: "System", note: "Ride completed" },
      { id: "PTX-9015", type: "admin_refund", amount: 9, at: "2024-07-12T15:20:00Z", actor: "Tobi Olatunji", note: "20% goodwill refund — DSP-3030" },
    ],
    previousAdminActions: [
      { id: "ACT-5", action: "assign_admin", by: "Mohammed Ibrahim", at: "2024-07-11T12:00:00Z", note: "Assigned to Tobi Olatunji" },
      { id: "ACT-6", action: "request_info", by: "Tobi Olatunji", at: "2024-07-11T12:30:00Z", note: "Requested driver statement" },
      { id: "ACT-7", action: "refund_points", by: "Tobi Olatunji", at: "2024-07-12T15:20:00Z", note: "9 points refunded" },
    ],
  },

  // ── Low rejected: trip not completed ──
  {
    id: "DSP-3028",
    rideId: "RDE-88208",
    reportedBy: "driver",
    user: { id: "USR-10005", name: "Ngozi Okwu", avatar: "NO", phone: "+234 818 234 5678" },
    driver: { id: "DRV-3391", name: "Akin Ogundimu", avatar: "AG", phone: "+234 808 765 4321" },
    reason: "trip_not_completed",
    rideStatus: "completed",
    pointsInvolved: 60,
    amountNGN: 5200,
    priority: "low",
    assignedAdmin: "Sarah Eze",
    createdAt: "2024-07-10T19:45:00Z",
    updatedAt: "2024-07-11T08:30:00Z",
    status: "rejected",
    userStatement: "Driver claims he didn't reach destination. He definitely dropped me at the correct address. This is a false claim.",
    driverStatement: "The user asked me to stop 800 metres short of the entered destination. I completed the trip at her request. Now she claims non-delivery to avoid being charged.",
    internalNotes: [
      { id: "N7", text: "GPS drop-off confirms 780m short of destination — consistent with driver account. User acknowledged the stop verbally in chat. Rejecting dispute.", author: "Sarah Eze", at: "2024-07-11T08:30:00Z", type: "action" },
    ],
    chatEvidence: true,
    callEvidence: false,
    resolution: {
      decision: "rejected",
      reason: "GPS evidence and chat log confirm trip was completed at user's own request. Driver acted correctly.",
      at: "2024-07-11T08:30:00Z",
      by: "Sarah Eze",
    },
    auditRefs: ["AUD-3290"],
    city: "Abuja",
    vehicleType: "sedan",
    ridePickup: "Garki, Moshood Abiola Way",
    rideDestination: "Asokoro, Parliament Drive",
    rideDistanceKm: 6.8,
    rideDurationMin: 27,
    rideTimeline: [
      { status: "offer_sent", at: "2024-07-10T19:00:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-10T19:00:50Z", actor: "Akin Ogundimu" },
      { status: "driver_on_way", at: "2024-07-10T19:01:10Z", actor: "System" },
      { status: "driver_arrived", at: "2024-07-10T19:12:00Z", actor: "Akin Ogundimu" },
      { status: "pickup_confirmed", at: "2024-07-10T19:13:00Z", actor: "Ngozi Okwu" },
      { status: "ride_started", at: "2024-07-10T19:13:30Z", actor: "System" },
      { status: "completed", at: "2024-07-10T19:40:30Z", actor: "System" },
    ],
    pointsTransactions: [
      { id: "PTX-9016", type: "offer_reservation", amount: -60, at: "2024-07-10T19:00:00Z", actor: "System", note: "Reserved for offer OFF-44001" },
      { id: "PTX-9017", type: "ride_debit", amount: -60, at: "2024-07-10T19:40:35Z", actor: "System", note: "Ride completed" },
    ],
    previousAdminActions: [
      { id: "ACT-8", action: "assign_admin", by: "Mohammed Ibrahim", at: "2024-07-10T20:00:00Z", note: "Assigned to Sarah Eze" },
    ],
  },
];

// ─── Stuck ride problems ───────────────────────────────────────────────────────

export type StuckReason =
  | "no_gps_update"
  | "state_timeout"
  | "orphaned_lock"
  | "terminal_ride_ref"
  | "lock_mismatch";

export type StuckSeverity = "critical" | "high" | "medium" | "low";

export interface StuckRide {
  id: string;
  rideId: string;
  severity: StuckSeverity;
  reason: StuckReason;
  title: string;
  detail: string;
  recommendedAction: string;
  detectedAt: string;
  rideStatus: string;
  driverName: string;
  driverId: string;
  driverAvatar: string;
  userName: string;
  userId: string;
  userAvatar: string;
  city: string;
  minutesInState: number;
  pointsAtRisk: number;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolveNote?: string;
  pickup: string;
  destination: string;
  fareNGN: number;
}

export const mockStuckRides: StuckRide[] = [
  {
    id: "STK-1001",
    rideId: "RDE-88265",
    severity: "critical",
    reason: "state_timeout",
    title: "Ride in_progress for 4h 30m",
    detail: "Ride RDE-88265 entered ride_started state 4h 30m ago. Maximum expected trip duration for this route is 90 minutes. Last GPS update was 5 hours ago. Driver phone is unreachable via in-app call.",
    recommendedAction: "Cancel ride, release driver lock, release point reservation, and flag driver account for welfare check.",
    detectedAt: "2024-07-14T04:15:00Z",
    rideStatus: "ride_started",
    driverName: "Chidi Obiora",
    driverId: "DRV-7741",
    driverAvatar: "CO",
    userName: "Yewande Olusanya",
    userId: "USR-10034",
    userAvatar: "YO",
    city: "Lagos",
    minutesInState: 270,
    pointsAtRisk: 85,
    resolved: false,
    pickup: "Ikeja, Obafemi Awolowo Way",
    destination: "Lekki Phase 1, Admiralty Way",
    fareNGN: 7200,
  },
  {
    id: "STK-1002",
    rideId: "RDE-88280",
    severity: "critical",
    reason: "no_gps_update",
    title: "No GPS signal for 3h 12m",
    detail: "Driver DRV-2058 has an active ride in driver_on_way state but has not transmitted GPS coordinates for 3h 12m. Last known position was near Apapa, Lagos. User has been waiting at pickup since 04:20.",
    recommendedAction: "Attempt in-app contact. If unreachable in 10 minutes, cancel ride and trigger welfare protocol for both driver and user.",
    detectedAt: "2024-07-14T05:42:00Z",
    rideStatus: "driver_on_way",
    driverName: "Mohammed Salami",
    driverId: "DRV-2058",
    driverAvatar: "MS",
    userName: "Adaobi Chukwu",
    userId: "USR-10041",
    userAvatar: "AC",
    city: "Lagos",
    minutesInState: 192,
    pointsAtRisk: 60,
    resolved: false,
    pickup: "Apapa, Creek Road",
    destination: "Marina, Broad Street",
    fareNGN: 4800,
  },
  {
    id: "STK-1003",
    rideId: "RDE-88244",
    severity: "high",
    reason: "orphaned_lock",
    title: "Driver locked to completed ride",
    detail: "Driver DRV-3819 has activeRideId set to RDE-88244 which completed 2h 10m ago. The lock was not released by the completion webhook — likely a race condition in the completion handler. Driver cannot receive new offers.",
    recommendedAction: "Release the orphaned ride lock. No points action required — ride completed correctly.",
    detectedAt: "2024-07-14T05:55:00Z",
    rideStatus: "completed",
    driverName: "Ifeanyi Okonkwo",
    driverId: "DRV-3819",
    driverAvatar: "IO",
    userName: "Bisi Olatunji",
    userId: "USR-10029",
    userAvatar: "BO",
    city: "Abuja",
    minutesInState: 130,
    pointsAtRisk: 0,
    resolved: false,
    pickup: "Wuse 2, Aminu Kano Crescent",
    destination: "Central Business District, Herbert Macaulay Way",
    fareNGN: 3100,
  },
  {
    id: "STK-1004",
    rideId: "RDE-88237",
    severity: "high",
    reason: "lock_mismatch",
    title: "User locked to ride, driver has moved on",
    detail: "User USR-10022 is still locked to offer OFF-44089 (RDE-88237). However, driver DRV-1823 was reassigned to a new offer 45 minutes ago. User cannot book a new ride. Offer OFF-44089 shows as pending but the driver is now unavailable.",
    recommendedAction: "Clear user offer lock and release offer OFF-44089 back to offer pool. Notify user that their previous booking was cancelled and they can rebook.",
    detectedAt: "2024-07-14T07:20:00Z",
    rideStatus: "offer_sent",
    driverName: "Olumide Adebayo",
    driverId: "DRV-1823",
    driverAvatar: "OA",
    userName: "Sola Adesanya",
    userId: "USR-10022",
    userAvatar: "SA",
    city: "Lagos",
    minutesInState: 45,
    pointsAtRisk: 40,
    resolved: false,
    pickup: "Maryland, Ikorodu Road",
    destination: "Gbagada, Gbagada Expressway",
    fareNGN: 2900,
  },
  {
    id: "STK-1005",
    rideId: "RDE-88199",
    severity: "medium",
    reason: "terminal_ride_ref",
    title: "Points reservation references cancelled ride",
    detail: "Driver DRV-5102 has a points reservation of 55 pts tied to RDE-88199 which was cancelled 6 hours ago. The reservation was not released because the cancellation event did not reach the points service (timeout). Driver's available balance is understated by 55 pts.",
    recommendedAction: "Manually release the orphaned points reservation. Log the missed webhook event for engineering review.",
    detectedAt: "2024-07-14T03:10:00Z",
    rideStatus: "cancelled_admin",
    driverName: "Emeka Chukwuemeka",
    driverId: "DRV-5102",
    driverAvatar: "EC",
    userName: "Remi Okonkwu",
    userId: "USR-10010",
    userAvatar: "RO",
    city: "Lagos",
    minutesInState: 360,
    pointsAtRisk: 55,
    resolved: false,
    pickup: "Yaba, Herbert Macaulay Way",
    destination: "Oshodi, Airport Road",
    fareNGN: 0,
  },
  {
    id: "STK-1006",
    rideId: "RDE-88185",
    severity: "low",
    reason: "state_timeout",
    title: "Offer pending for 28 minutes",
    detail: "Offer for RDE-88185 has been in offer_sent state for 28 minutes with no driver response. System typically expires offers after 15 minutes. The expiry job may have missed this record in the last sweep.",
    recommendedAction: "Expire the offer, release user booking, and send a new-offer notification so user can retry.",
    detectedAt: "2024-07-14T07:40:00Z",
    rideStatus: "offer_sent",
    driverName: "—",
    driverId: "",
    driverAvatar: "?",
    userName: "Chukwudi Nwachukwu",
    userId: "USR-10007",
    userAvatar: "CN",
    city: "Abuja",
    minutesInState: 28,
    pointsAtRisk: 35,
    resolved: false,
    pickup: "Garki, Moshood Abiola Way",
    destination: "Wuse Market",
    fareNGN: 2600,
  },
  {
    id: "STK-1007",
    rideId: "RDE-88170",
    severity: "low",
    reason: "no_gps_update",
    title: "Stale GPS — 22 minutes since last ping",
    detail: "Driver DRV-4477 has a ride in pickup_confirmed state. Last GPS ping was 22 minutes ago. Driver is likely in a low-signal area (Apapa Port). Ride state is progressing but live map shows driver frozen at last known location.",
    recommendedAction: "No immediate action needed. Monitor for 15 more minutes. If no update, escalate to high.",
    detectedAt: "2024-07-14T07:35:00Z",
    rideStatus: "pickup_confirmed",
    driverName: "Seun Babatunde",
    driverId: "DRV-4477",
    driverAvatar: "SB",
    userName: "Funke Adeyemi",
    userId: "USR-10015",
    userAvatar: "FA",
    city: "Lagos",
    minutesInState: 22,
    pointsAtRisk: 50,
    resolved: false,
    pickup: "Apapa Port, Wharf Road",
    destination: "Broad Street, Lagos Island",
    fareNGN: 3800,
  },
  // Resolved example
  {
    id: "STK-1000",
    rideId: "RDE-88155",
    severity: "high",
    reason: "orphaned_lock",
    title: "Driver locked to voided offer",
    detail: "Driver DRV-2244 was locked to offer OFF-44000 which was voided by admin 3 hours ago. Lock persisted due to a missed cleanup task.",
    recommendedAction: "Release ride lock. No points action required.",
    detectedAt: "2024-07-13T18:00:00Z",
    rideStatus: "cancelled_admin",
    driverName: "Uche Nnamdi",
    driverId: "DRV-2244",
    driverAvatar: "UN",
    userName: "Aisha Musa",
    userId: "USR-10003",
    userAvatar: "AM",
    city: "Abuja",
    minutesInState: 180,
    pointsAtRisk: 0,
    resolved: true,
    resolvedAt: "2024-07-13T21:30:00Z",
    resolvedBy: "Mohammed Ibrahim",
    resolveNote: "Lock released manually. Webhook gap reported to engineering.",
    pickup: "Maitama, Adetokunbo Ademola Crescent",
    destination: "Asokoro, Parliament Drive",
    fareNGN: 0,
  },
];

// ─── Audit log helpers ─────────────────────────────────────────────────────────

export function createDisputeAuditEntry(
  disputeId: string,
  action: string,
  actor: string,
  detail: string,
): { id: string; actor: string; action: string; entityType: string; entityId: string; detail: string; at: string } {
  return {
    id: `AUD-${Date.now()}`,
    actor,
    action,
    entityType: "Dispute",
    entityId: disputeId,
    detail,
    at: new Date().toISOString(),
  };
}

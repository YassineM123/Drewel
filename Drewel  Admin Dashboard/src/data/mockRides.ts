// ─── Rides ───────────────────────────────────────────────────────────────────

export type RideStatus =
  | "offer_sent"          // Offer Pending
  | "offer_accepted"      // Confirmed
  | "driver_on_way"       // Driver on the Way
  | "driver_arrived"      // Driver Arrived
  | "pickup_confirmed"    // Pickup Confirmed
  | "ride_started"        // In Progress
  | "completed"           // Completed
  | "cancelled_user"      // Cancelled by User
  | "cancelled_driver"    // Cancelled by Driver
  | "cancelled_admin"     // Cancelled by Admin
  | "cancelled"           // Generic / legacy
  | "disputed"            // Disputed
  | "technical_failure";  // Technical Failure

export interface Ride {
  id: string;
  offerId: string;
  driver: { id: string; name: string; avatar: string; phone: string };
  user: { id: string; name: string; avatar: string; phone: string };
  pickup: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  status: RideStatus;
  fareNGN: number;
  vehicleType: "sedan" | "suv" | "premium";
  pointsCharged: number;
  pointsReserved: number;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  createdAt: string;
  eta: number | null;
  distanceKm: number | null;
  lastLocationUpdate: string | null;
  isStuck: boolean;
  isStaleLocation: boolean;
  isDisputed: boolean;
  disputeNote: string | null;
  city: string;
  adminNote: string | null;
  internalNotes: { id: string; text: string; author: string; at: string }[];
  timeline: { status: RideStatus; at: string; actor: string }[];
}

export const mockRides: Ride[] = [
  // ── Active: Offer Pending ──────────────────────────────────────────────
  {
    id: "RDE-88305",
    offerId: "OFF-44120",
    driver: { id: "DRV-1823", name: "Olumide Adebayo", avatar: "OA", phone: "+234 804 567 8901" },
    user: { id: "USR-10024", name: "Dauda Abubakar", avatar: "DA", phone: "+234 813 456 7890" },
    pickup: { address: "Tafawa Balewa Square, Lagos Island", lat: 6.4536, lng: 3.3916 },
    destination: { address: "Barkindo Street, Victoria Island", lat: 6.4296, lng: 3.4181 },
    status: "offer_sent",
    fareNGN: 2400,
    vehicleType: "sedan",
    pointsCharged: 0,
    pointsReserved: 0,
    startedAt: null, completedAt: null, cancelledAt: null,
    cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-14T07:55:00Z",
    eta: 6, distanceKm: 4.1,
    lastLocationUpdate: null,
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent", at: "2024-07-14T07:55:00Z", actor: "System" },
    ],
  },

  // ── Active: Driver Arrived ──────────────────────────────────────────────
  {
    id: "RDE-88301",
    offerId: "OFF-44115",
    driver: { id: "DRV-5102", name: "Emeka Chukwuemeka", avatar: "EC", phone: "+234 805 678 9012" },
    user: { id: "USR-10021", name: "Temi Afolabi", avatar: "TA", phone: "+234 810 123 4567" },
    pickup: { address: "Opebi Road, Ikeja", lat: 6.5870, lng: 3.3531 },
    destination: { address: "Mobolaji Bank Anthony Way, Maryland", lat: 6.5579, lng: 3.3562 },
    status: "driver_arrived",
    fareNGN: 1800,
    vehicleType: "sedan",
    pointsCharged: 20,
    pointsReserved: 20,
    startedAt: null, completedAt: null, cancelledAt: null,
    cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-14T07:44:00Z",
    eta: 0, distanceKm: 3.9,
    lastLocationUpdate: "2024-07-14T07:52:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",     at: "2024-07-14T07:44:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-14T07:44:50Z", actor: "Emeka Chukwuemeka" },
      { status: "driver_on_way",  at: "2024-07-14T07:45:10Z", actor: "System" },
      { status: "driver_arrived", at: "2024-07-14T07:51:40Z", actor: "Emeka Chukwuemeka" },
    ],
  },

  // ── Active: In Progress ─────────────────────────────────────────────────
  {
    id: "RDE-88291",
    offerId: "OFF-44109",
    driver: { id: "DRV-4421", name: "Marcus Oyelaran", avatar: "MO", phone: "+234 801 234 5678" },
    user: { id: "USR-10021", name: "Temi Afolabi", avatar: "TA", phone: "+234 810 123 4567" },
    pickup: { address: "16 Ozumba Mbadiwe Ave, Victoria Island", lat: 6.4281, lng: 3.4219 },
    destination: { address: "Palms Shopping Mall, Lekki", lat: 6.4474, lng: 3.4722 },
    status: "ride_started",
    fareNGN: 2800,
    vehicleType: "sedan",
    pointsCharged: 20,
    pointsReserved: 20,
    startedAt: "2024-07-14T07:12:00Z",
    completedAt: null, cancelledAt: null, cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-14T07:00:00Z",
    eta: 14, distanceKm: 8.2,
    lastLocationUpdate: "2024-07-14T07:41:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",       at: "2024-07-14T07:00:00Z", actor: "System" },
      { status: "offer_accepted",   at: "2024-07-14T07:02:30Z", actor: "Marcus Oyelaran" },
      { status: "driver_on_way",    at: "2024-07-14T07:03:00Z", actor: "System" },
      { status: "driver_arrived",   at: "2024-07-14T07:10:00Z", actor: "Marcus Oyelaran" },
      { status: "pickup_confirmed", at: "2024-07-14T07:11:45Z", actor: "System (PIN)" },
      { status: "ride_started",     at: "2024-07-14T07:12:00Z", actor: "System" },
    ],
  },

  // ── Active: In Progress ─────────────────────────────────────────────────
  {
    id: "RDE-88289",
    offerId: "OFF-44108",
    driver: { id: "DRV-5102", name: "Emeka Chukwuemeka", avatar: "EC", phone: "+234 805 678 9012" },
    user: { id: "USR-10023", name: "Ngozi Ibe", avatar: "NI", phone: "+234 812 345 6789" },
    pickup: { address: "Airport Road, Ikeja", lat: 6.5774, lng: 3.3212 },
    destination: { address: "Balogun Market, Lagos Island", lat: 6.4549, lng: 3.3940 },
    status: "ride_started",
    fareNGN: 4200,
    vehicleType: "sedan",
    pointsCharged: 20,
    pointsReserved: 20,
    startedAt: "2024-07-14T07:31:00Z",
    completedAt: null, cancelledAt: null, cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-14T07:20:00Z",
    eta: 22, distanceKm: 14.6,
    lastLocationUpdate: "2024-07-14T07:40:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",       at: "2024-07-14T07:20:00Z", actor: "System" },
      { status: "offer_accepted",   at: "2024-07-14T07:21:10Z", actor: "Emeka Chukwuemeka" },
      { status: "driver_on_way",    at: "2024-07-14T07:21:30Z", actor: "System" },
      { status: "driver_arrived",   at: "2024-07-14T07:29:00Z", actor: "Emeka Chukwuemeka" },
      { status: "pickup_confirmed", at: "2024-07-14T07:30:45Z", actor: "System (PIN)" },
      { status: "ride_started",     at: "2024-07-14T07:31:00Z", actor: "System" },
    ],
  },

  // ── Active: Driver on the Way ────────────────────────────────────────────
  {
    id: "RDE-88280",
    offerId: "OFF-44101",
    driver: { id: "DRV-1823", name: "Olumide Adebayo", avatar: "OA", phone: "+234 804 567 8901" },
    user: { id: "USR-10024", name: "Dauda Abubakar", avatar: "DA", phone: "+234 813 456 7890" },
    pickup: { address: "National Stadium, Surulere", lat: 6.5014, lng: 3.3598 },
    destination: { address: "Eko Hotel, Victoria Island", lat: 6.4282, lng: 3.4210 },
    status: "driver_on_way",
    fareNGN: 3100,
    vehicleType: "suv",
    pointsCharged: 20,
    pointsReserved: 20,
    startedAt: null, completedAt: null, cancelledAt: null, cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-14T07:38:00Z",
    eta: 8, distanceKm: 11.3,
    lastLocationUpdate: "2024-07-14T07:41:30Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",     at: "2024-07-14T07:38:00Z", actor: "System" },
      { status: "offer_accepted", at: "2024-07-14T07:38:55Z", actor: "Olumide Adebayo" },
      { status: "driver_on_way",  at: "2024-07-14T07:39:10Z", actor: "System" },
    ],
  },

  // ── STUCK ────────────────────────────────────────────────────────────────
  {
    id: "RDE-88265",
    offerId: "OFF-44089",
    driver: { id: "DRV-4421", name: "Marcus Oyelaran", avatar: "MO", phone: "+234 801 234 5678" },
    user: { id: "USR-10022", name: "Kola Mensah", avatar: "KM", phone: "+234 811 234 5678" },
    pickup: { address: "Murtala Muhammed Airport T2, Ikeja", lat: 6.5774, lng: 3.3212 },
    destination: { address: "Ikorodu Road, Lagos", lat: 6.5330, lng: 3.3820 },
    status: "ride_started",
    fareNGN: 2600,
    vehicleType: "sedan",
    pointsCharged: 20,
    pointsReserved: 20,
    startedAt: "2024-07-14T03:10:00Z",
    completedAt: null, cancelledAt: null, cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-14T03:00:00Z",
    eta: null, distanceKm: 9.1,
    lastLocationUpdate: "2024-07-14T03:12:00Z",
    isStuck: true,
    isStaleLocation: true,
    isDisputed: false, disputeNote: null,
    city: "Lagos",
    adminNote: "Driver not responding to calls. Possible app crash.",
    internalNotes: [
      { id: "NOTE-01", text: "Called driver — no answer. Sent SMS. Waiting 15 minutes before escalating.", author: "S. Chen", at: "2024-07-14T05:20:00Z" },
    ],
    timeline: [
      { status: "offer_sent",       at: "2024-07-14T03:00:00Z", actor: "System" },
      { status: "offer_accepted",   at: "2024-07-14T03:01:30Z", actor: "Marcus Oyelaran" },
      { status: "driver_on_way",    at: "2024-07-14T03:02:00Z", actor: "System" },
      { status: "driver_arrived",   at: "2024-07-14T03:09:00Z", actor: "Marcus Oyelaran" },
      { status: "pickup_confirmed", at: "2024-07-14T03:09:40Z", actor: "System (PIN)" },
      { status: "ride_started",     at: "2024-07-14T03:10:00Z", actor: "System" },
    ],
  } as unknown as Ride,

  // ── Completed ────────────────────────────────────────────────────────────
  {
    id: "RDE-88200",
    offerId: "OFF-44020",
    driver: { id: "DRV-3814", name: "Adaeze Nwosu", avatar: "AN", phone: "+234 802 345 6789" },
    user: { id: "USR-10021", name: "Temi Afolabi", avatar: "TA", phone: "+234 810 123 4567" },
    pickup: { address: "Wuse Market, Abuja", lat: 9.0631, lng: 7.4836 },
    destination: { address: "Garki District, Abuja", lat: 9.0440, lng: 7.4827 },
    status: "completed",
    fareNGN: 1600,
    vehicleType: "sedan",
    pointsCharged: 20,
    pointsReserved: 0,
    startedAt: "2024-07-13T14:05:00Z",
    completedAt: "2024-07-13T14:29:00Z",
    cancelledAt: null, cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-13T14:00:00Z",
    eta: null, distanceKm: 5.8,
    lastLocationUpdate: "2024-07-13T14:29:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Abuja", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",       at: "2024-07-13T14:00:00Z", actor: "System" },
      { status: "offer_accepted",   at: "2024-07-13T14:01:05Z", actor: "Adaeze Nwosu" },
      { status: "driver_on_way",    at: "2024-07-13T14:01:20Z", actor: "System" },
      { status: "driver_arrived",   at: "2024-07-13T14:04:00Z", actor: "Adaeze Nwosu" },
      { status: "pickup_confirmed", at: "2024-07-13T14:04:50Z", actor: "System (PIN)" },
      { status: "ride_started",     at: "2024-07-13T14:05:00Z", actor: "System" },
      { status: "completed",        at: "2024-07-13T14:29:00Z", actor: "System (geofence)" },
    ],
  },

  // ── Cancelled by User ────────────────────────────────────────────────────
  {
    id: "RDE-88189",
    offerId: "OFF-44010",
    driver: { id: "DRV-2908", name: "Fatima Al-Rashidi", avatar: "FA", phone: "+234 803 456 7890" },
    user: { id: "USR-10022", name: "Kola Mensah", avatar: "KM", phone: "+234 811 234 5678" },
    pickup: { address: "Lekki Phase 1, Lagos", lat: 6.4474, lng: 3.4722 },
    destination: { address: "Chevron Drive, Lekki", lat: 6.4350, lng: 3.5060 },
    status: "cancelled_user",
    fareNGN: 0,
    vehicleType: "suv",
    pointsCharged: 0,
    pointsReserved: 0,
    startedAt: null, completedAt: null,
    cancelledAt: "2024-07-13T12:18:00Z",
    cancelReason: "Driver did not arrive within reasonable time",
    cancelledBy: "Kola Mensah (user)",
    createdAt: "2024-07-13T12:00:00Z",
    eta: null, distanceKm: 4.3,
    lastLocationUpdate: "2024-07-13T12:10:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",      at: "2024-07-13T12:00:00Z", actor: "System" },
      { status: "offer_accepted",  at: "2024-07-13T12:01:20Z", actor: "Fatima Al-Rashidi" },
      { status: "driver_on_way",   at: "2024-07-13T12:01:40Z", actor: "System" },
      { status: "cancelled_user",  at: "2024-07-13T12:18:00Z", actor: "Kola Mensah (user)" },
    ],
  },

  // ── Disputed ─────────────────────────────────────────────────────────────
  {
    id: "RDE-88175",
    offerId: "OFF-43998",
    driver: { id: "DRV-5102", name: "Emeka Chukwuemeka", avatar: "EC", phone: "+234 805 678 9012" },
    user: { id: "USR-10024", name: "Dauda Abubakar", avatar: "DA", phone: "+234 813 456 7890" },
    pickup: { address: "Ikeja City Mall, Ikeja", lat: 6.6018, lng: 3.3515 },
    destination: { address: "Maryland Mall, Lagos", lat: 6.5563, lng: 3.3552 },
    status: "disputed",
    fareNGN: 1900,
    vehicleType: "sedan",
    pointsCharged: 20,
    pointsReserved: 0,
    startedAt: "2024-07-13T10:02:00Z",
    completedAt: "2024-07-13T10:19:00Z",
    cancelledAt: null, cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-13T09:55:00Z",
    eta: null, distanceKm: 4.1,
    lastLocationUpdate: "2024-07-13T10:19:00Z",
    isStuck: false, isStaleLocation: false,
    isDisputed: true,
    disputeNote: "Passenger claims driver took a longer route deliberately. Driver disputes this. GPS data needed.",
    city: "Lagos", adminNote: null,
    internalNotes: [
      { id: "NOTE-02", text: "Requested GPS trace from engineering. Awaiting data.", author: "S. Chen", at: "2024-07-13T11:00:00Z" },
    ],
    timeline: [
      { status: "offer_sent",       at: "2024-07-13T09:55:00Z", actor: "System" },
      { status: "offer_accepted",   at: "2024-07-13T09:56:00Z", actor: "Emeka Chukwuemeka" },
      { status: "driver_on_way",    at: "2024-07-13T09:56:20Z", actor: "System" },
      { status: "driver_arrived",   at: "2024-07-13T10:01:00Z", actor: "Emeka Chukwuemeka" },
      { status: "pickup_confirmed", at: "2024-07-13T10:01:45Z", actor: "System (PIN)" },
      { status: "ride_started",     at: "2024-07-13T10:02:00Z", actor: "System" },
      { status: "completed",        at: "2024-07-13T10:19:00Z", actor: "System (geofence)" },
      { status: "disputed",         at: "2024-07-13T10:45:00Z", actor: "Dauda Abubakar (user)" },
    ],
  },

  // ── Cancelled by Driver ──────────────────────────────────────────────────
  {
    id: "RDE-88160",
    offerId: "OFF-43980",
    driver: { id: "DRV-3814", name: "Adaeze Nwosu", avatar: "AN", phone: "+234 802 345 6789" },
    user: { id: "USR-10023", name: "Ngozi Ibe", avatar: "NI", phone: "+234 812 345 6789" },
    pickup: { address: "Oshodi Interchange, Oshodi", lat: 6.5559, lng: 3.3478 },
    destination: { address: "Mile 2, Amuwo Odofin", lat: 6.4887, lng: 3.3218 },
    status: "cancelled_driver",
    fareNGN: 0,
    vehicleType: "sedan",
    pointsCharged: 0,
    pointsReserved: 0,
    startedAt: null, completedAt: null,
    cancelledAt: "2024-07-13T08:42:00Z",
    cancelReason: "Vehicle malfunction — driver cancelled before arrival",
    cancelledBy: "Adaeze Nwosu (driver)",
    createdAt: "2024-07-13T08:30:00Z",
    eta: null, distanceKm: 6.2,
    lastLocationUpdate: "2024-07-13T08:42:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",       at: "2024-07-13T08:30:00Z", actor: "System" },
      { status: "offer_accepted",   at: "2024-07-13T08:31:10Z", actor: "Adaeze Nwosu" },
      { status: "driver_on_way",    at: "2024-07-13T08:31:30Z", actor: "System" },
      { status: "cancelled_driver", at: "2024-07-13T08:42:00Z", actor: "Adaeze Nwosu (driver)" },
    ],
  },

  // ── Cancelled by Admin ────────────────────────────────────────────────────
  {
    id: "RDE-88140",
    offerId: "OFF-43960",
    driver: { id: "DRV-1823", name: "Olumide Adebayo", avatar: "OA", phone: "+234 804 567 8901" },
    user: { id: "USR-10022", name: "Kola Mensah", avatar: "KM", phone: "+234 811 234 5678" },
    pickup: { address: "CMS Bus Stop, Lagos Island", lat: 6.4540, lng: 3.3921 },
    destination: { address: "Idumota Market, Lagos Island", lat: 6.4598, lng: 3.3912 },
    status: "cancelled_admin",
    fareNGN: 0,
    vehicleType: "sedan",
    pointsCharged: 0,
    pointsReserved: 0,
    startedAt: null, completedAt: null,
    cancelledAt: "2024-07-13T06:50:00Z",
    cancelReason: "Cancelled by admin — GPS failure, points refunded",
    cancelledBy: "S. Chen (admin)",
    createdAt: "2024-07-13T06:30:00Z",
    eta: null, distanceKm: 1.2,
    lastLocationUpdate: "2024-07-13T06:38:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos",
    adminNote: "GPS API returned 503. Point reservation released, no charge to driver.",
    internalNotes: [
      { id: "NOTE-03", text: "Cancelled and released reservation. Driver notified via push.", author: "S. Chen", at: "2024-07-13T06:50:00Z" },
    ],
    timeline: [
      { status: "offer_sent",      at: "2024-07-13T06:30:00Z", actor: "System" },
      { status: "offer_accepted",  at: "2024-07-13T06:31:00Z", actor: "Olumide Adebayo" },
      { status: "driver_on_way",   at: "2024-07-13T06:31:20Z", actor: "System" },
      { status: "cancelled_admin", at: "2024-07-13T06:50:00Z", actor: "S. Chen (admin)" },
    ],
  },

  // ── Completed (Lagos, Premium) ────────────────────────────────────────────
  {
    id: "RDE-88120",
    offerId: "OFF-43940",
    driver: { id: "DRV-4421", name: "Marcus Oyelaran", avatar: "MO", phone: "+234 801 234 5678" },
    user: { id: "USR-10023", name: "Ngozi Ibe", avatar: "NI", phone: "+234 812 345 6789" },
    pickup: { address: "Onikan Stadium, Lagos Island", lat: 6.4522, lng: 3.4005 },
    destination: { address: "Lekki Conservation Centre", lat: 6.4434, lng: 3.5073 },
    status: "completed",
    fareNGN: 3800,
    vehicleType: "premium",
    pointsCharged: 20,
    pointsReserved: 0,
    startedAt: "2024-07-13T05:22:00Z",
    completedAt: "2024-07-13T05:48:00Z",
    cancelledAt: null, cancelReason: null, cancelledBy: null,
    createdAt: "2024-07-13T05:10:00Z",
    eta: null, distanceKm: 15.2,
    lastLocationUpdate: "2024-07-13T05:48:00Z",
    isStuck: false, isStaleLocation: false, isDisputed: false, disputeNote: null,
    city: "Lagos", adminNote: null, internalNotes: [],
    timeline: [
      { status: "offer_sent",       at: "2024-07-13T05:10:00Z", actor: "System" },
      { status: "offer_accepted",   at: "2024-07-13T05:11:30Z", actor: "Marcus Oyelaran" },
      { status: "driver_on_way",    at: "2024-07-13T05:12:00Z", actor: "System" },
      { status: "driver_arrived",   at: "2024-07-13T05:20:00Z", actor: "Marcus Oyelaran" },
      { status: "pickup_confirmed", at: "2024-07-13T05:21:45Z", actor: "System (PIN)" },
      { status: "ride_started",     at: "2024-07-13T05:22:00Z", actor: "System" },
      { status: "completed",        at: "2024-07-13T05:48:00Z", actor: "System (geofence)" },
    ],
  },
];

// ─── Points ───────────────────────────────────────────────────────────────────

export type PointTransactionType =
  | "welcome_credit"
  | "purchased_credit"
  | "offer_reservation"
  | "reservation_release"
  | "ride_debit"
  | "admin_refund"
  | "admin_correction";

export interface PointTransaction {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatar: string;
  type: PointTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  rideId: string | null;
  offerId: string | null;
  paymentRef: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export const mockPointTransactions: PointTransaction[] = [
  { id: "TXN-9901", driverId: "DRV-4421", driverName: "Marcus Oyelaran", driverAvatar: "MO", type: "purchased_credit", amount: 100, balanceBefore: 124, balanceAfter: 224, reservedBefore: 20, reservedAfter: 20, rideId: null, offerId: null, paymentRef: "PAY-GTB-20240714-001", reason: "Purchased 100 points via GTBank transfer", createdBy: "S. Chen (Admin)", createdAt: "2024-07-14T09:00:00Z" },
  { id: "TXN-9900", driverId: "DRV-4421", driverName: "Marcus Oyelaran", driverAvatar: "MO", type: "offer_reservation", amount: -20, balanceBefore: 144, balanceAfter: 124, reservedBefore: 0, reservedAfter: 20, rideId: "RDE-88291", offerId: "OFF-44109", paymentRef: null, reason: "Points reserved for Trip Offer OFF-44109", createdBy: "System", createdAt: "2024-07-14T07:00:10Z" },
  { id: "TXN-9899", driverId: "DRV-5102", driverName: "Emeka Chukwuemeka", driverAvatar: "EC", type: "welcome_credit", amount: 100, balanceBefore: 0, balanceAfter: 100, reservedBefore: 0, reservedAfter: 0, rideId: null, offerId: null, paymentRef: null, reason: "Welcome bonus on account approval", createdBy: "System", createdAt: "2024-07-13T19:50:00Z" },
  { id: "TXN-9898", driverId: "DRV-1823", driverName: "Olumide Adebayo", driverAvatar: "OA", type: "ride_debit", amount: -20, balanceBefore: 85, balanceAfter: 65, reservedBefore: 20, reservedAfter: 0, rideId: "RDE-88200", offerId: "OFF-44020", paymentRef: null, reason: "Ride completed — points debited", createdBy: "System", createdAt: "2024-07-13T14:29:10Z" },
  { id: "TXN-9897", driverId: "DRV-3814", driverName: "Adaeze Nwosu", driverAvatar: "AN", type: "reservation_release", amount: 20, balanceBefore: 45, balanceAfter: 65, reservedBefore: 20, reservedAfter: 0, rideId: "RDE-88189", offerId: "OFF-44010", paymentRef: null, reason: "Reservation released — ride cancelled by user", createdBy: "System", createdAt: "2024-07-13T12:18:10Z" },
  { id: "TXN-9896", driverId: "DRV-2908", driverName: "Fatima Al-Rashidi", driverAvatar: "FA", type: "admin_refund", amount: 20, balanceBefore: 12, balanceAfter: 32, reservedBefore: 0, reservedAfter: 0, rideId: "RDE-88100", offerId: null, paymentRef: null, reason: "Refund for GPS failure on RDE-88100 — verified by S. Chen", createdBy: "S. Chen (Admin)", createdAt: "2024-07-12T15:30:00Z" },
  { id: "TXN-9895", driverId: "DRV-4421", driverName: "Marcus Oyelaran", driverAvatar: "MO", type: "purchased_credit", amount: 50, balanceBefore: 94, balanceAfter: 144, reservedBefore: 0, reservedAfter: 0, rideId: null, offerId: null, paymentRef: "PAY-ZGT-20240712-008", reason: "Purchased 50 points via Zenith Bank transfer", createdBy: "R. Nakamura (Admin)", createdAt: "2024-07-12T10:15:00Z" },
];

export interface DriverPointBalance {
  driverId: string;
  driverName: string;
  driverAvatar: string;
  phone: string;
  approvalStatus: "approved" | "pending" | "rejected";
  available: number;
  reserved: number;
  totalPurchased: number;
  totalConsumed: number;
  activeRideId: string | null;
  lastTxAt: string;
  restricted: boolean;
  city: string;
}

export const mockDriverPointBalances: DriverPointBalance[] = [
  { driverId: "DRV-4421", driverName: "Marcus Oyelaran", driverAvatar: "MO", phone: "+234 801 *** 5678", approvalStatus: "approved", available: 224, reserved: 20, totalPurchased: 250, totalConsumed: 126, activeRideId: "RDE-88291", lastTxAt: "2024-07-14T09:00:00Z", restricted: false, city: "Lagos" },
  { driverId: "DRV-5102", driverName: "Emeka Chukwuemeka", driverAvatar: "EC", phone: "+234 805 *** 9012", approvalStatus: "approved", available: 80, reserved: 20, totalPurchased: 100, totalConsumed: 20, activeRideId: "RDE-88289", lastTxAt: "2024-07-13T19:50:00Z", restricted: false, city: "Lagos" },
  { driverId: "DRV-1823", driverName: "Olumide Adebayo", driverAvatar: "OA", phone: "+234 804 *** 8901", approvalStatus: "approved", available: 65, reserved: 0, totalPurchased: 100, totalConsumed: 55, activeRideId: null, lastTxAt: "2024-07-13T14:29:00Z", restricted: false, city: "Lagos" },
  { driverId: "DRV-3814", driverName: "Adaeze Nwosu", driverAvatar: "AN", phone: "+234 802 *** 6789", approvalStatus: "pending", available: 65, reserved: 0, totalPurchased: 100, totalConsumed: 55, activeRideId: null, lastTxAt: "2024-07-13T12:18:00Z", restricted: false, city: "Lagos" },
  { driverId: "DRV-2908", driverName: "Fatima Al-Rashidi", driverAvatar: "FA", phone: "+234 803 *** 7890", approvalStatus: "rejected", available: 12, reserved: 0, totalPurchased: 50, totalConsumed: 58, activeRideId: null, lastTxAt: "2024-07-12T15:30:00Z", restricted: true, city: "Abuja" },
];

export type PointRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface PointRequest {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatar: string;
  currentBalance: number;
  requestedPoints: number;
  contactRef: string;
  requestedAt: string;
  status: PointRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  city: string;
}

export const mockPointRequests: PointRequest[] = [
  { id: "REQ-501", driverId: "DRV-1823", driverName: "Olumide Adebayo", driverAvatar: "OA", currentBalance: 65, requestedPoints: 100, contactRef: "Sent WhatsApp proof — Zenith Acct 0012345678", requestedAt: "2024-07-14T06:30:00Z", status: "pending", reviewedBy: null, reviewedAt: null, adminNote: null, city: "Lagos" },
  { id: "REQ-500", driverId: "DRV-3814", driverName: "Adaeze Nwosu", driverAvatar: "AN", currentBalance: 65, requestedPoints: 50, contactRef: "GTBank teller receipt No. 2024071400928", requestedAt: "2024-07-13T18:00:00Z", status: "pending", reviewedBy: null, reviewedAt: null, adminNote: null, city: "Lagos" },
  { id: "REQ-499", driverId: "DRV-2908", driverName: "Fatima Al-Rashidi", driverAvatar: "FA", currentBalance: 12, requestedPoints: 50, contactRef: "UBA transfer — REF: 20240712UB491029", requestedAt: "2024-07-12T14:00:00Z", status: "rejected", reviewedBy: "S. Chen", reviewedAt: "2024-07-12T16:00:00Z", adminNote: "Account currently restricted pending re-verification. Request cannot be processed.", city: "Abuja" },
  { id: "REQ-498", driverId: "DRV-5102", driverName: "Emeka Chukwuemeka", driverAvatar: "EC", currentBalance: 100, requestedPoints: 100, contactRef: "Fidelity Bank — TXN ID FD20240713882910", requestedAt: "2024-07-13T08:00:00Z", status: "approved", reviewedBy: "R. Nakamura", reviewedAt: "2024-07-13T10:00:00Z", adminNote: "Verified against bank statement. Welcome credit supplemented.", city: "Lagos" },
];

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface AdminAlert {
  id: string;
  severity: AlertSeverity;
  type: string;
  title: string;
  message: string;
  rideId: string | null;
  driverId: string | null;
  userId: string | null;
  createdAt: string;
  status: AlertStatus;
  assignedTo: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export const mockAlerts: AdminAlert[] = [
  { id: "ALT-801", severity: "critical", type: "stuck_ride", title: "Ride stuck In Progress for 4h 30m", message: "RDE-88265 has been In Progress since 03:10. Driver location is stale (last update 4h 29m ago). Possible app crash or phone off.", rideId: "RDE-88265", driverId: "DRV-4421", userId: null, createdAt: "2024-07-14T05:00:00Z", status: "open", assignedTo: null, resolvedAt: null, resolutionNote: null },
  { id: "ALT-800", severity: "critical", type: "stale_location", title: "Stale driver location — RDE-88265", message: "Driver Marcus Oyelaran (DRV-4421) last location update was 4h 29m ago during an active ride. Possible GPS or connectivity issue.", rideId: "RDE-88265", driverId: "DRV-4421", userId: null, createdAt: "2024-07-14T04:30:00Z", status: "open", assignedTo: null, resolvedAt: null, resolutionNote: null },
  { id: "ALT-799", severity: "warning", type: "disputed_ride", title: "Ride RDE-88175 disputed by passenger", message: "Dauda Abubakar filed a dispute for completed ride RDE-88175. Claim: driver took a longer route deliberately.", rideId: "RDE-88175", driverId: "DRV-5102", userId: "USR-10024", createdAt: "2024-07-13T10:45:00Z", status: "open", assignedTo: "S. Chen", resolvedAt: null, resolutionNote: null },
  { id: "ALT-798", severity: "warning", type: "low_balance", title: "Driver Fatima Al-Rashidi has 12 available points", message: "DRV-2908 available balance (12) is below the minimum threshold of 20 required to accept rides.", rideId: null, driverId: "DRV-2908", userId: null, createdAt: "2024-07-12T16:00:00Z", status: "acknowledged", assignedTo: "R. Nakamura", resolvedAt: null, resolutionNote: null },
  { id: "ALT-797", severity: "info", type: "google_routes_failure", title: "Google Routes API returned error 503", message: "2 ride offers failed to receive route data at 06:14. Offers proceeded without ETA. Check API quota.", rideId: null, driverId: null, userId: null, createdAt: "2024-07-14T06:14:00Z", status: "resolved", assignedTo: "S. Chen", resolvedAt: "2024-07-14T06:45:00Z", resolutionNote: "Confirmed transient Google outage. Monitoring normal at 06:45." },
];

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  ip: string;
  createdAt: string;
}

export const mockAuditLogs: AuditLogEntry[] = [
  { id: "AUD-2201", actor: "S. Chen", role: "Admin", action: "add_points", entityType: "DriverPoints", entityId: "DRV-4421", oldValue: "balance: 124", newValue: "balance: 224", reason: "Purchased 100 points — PAY-GTB-20240714-001", ip: "105.112.*.***", createdAt: "2024-07-14T09:00:00Z" },
  { id: "AUD-2200", actor: "J. Kowalski", role: "Admin", action: "approve_verification_a1", entityType: "VerificationRequest", entityId: "VRQ-2024-0891", oldValue: "status: pending", newValue: "status: approved", reason: null, ip: "105.113.*.***", createdAt: "2024-07-14T10:05:00Z" },
  { id: "AUD-2199", actor: "J. Kowalski", role: "Admin", action: "reject_verification_a1", entityType: "VerificationRequest", entityId: "VRQ-2024-0888", oldValue: "status: pending", newValue: "status: rejected", reason: "Vehicle registration expired", ip: "105.113.*.***", createdAt: "2024-07-13T16:00:00Z" },
  { id: "AUD-2198", actor: "R. Nakamura", role: "Admin", action: "approve_point_request", entityType: "PointRequest", entityId: "REQ-498", oldValue: "status: pending", newValue: "status: approved, +100pts", reason: "Verified against bank statement", ip: "41.190.*.***", createdAt: "2024-07-13T10:00:00Z" },
  { id: "AUD-2197", actor: "S. Chen", role: "Admin", action: "admin_refund", entityType: "DriverPoints", entityId: "DRV-2908", oldValue: "balance: 12", newValue: "balance: 32", reason: "GPS failure on RDE-88100", ip: "105.112.*.***", createdAt: "2024-07-12T15:30:00Z" },
  { id: "AUD-2196", actor: "S. Chen", role: "Admin", action: "reject_point_request", entityType: "PointRequest", entityId: "REQ-499", oldValue: "status: pending", newValue: "status: rejected", reason: "Account restricted pending re-verification", ip: "105.112.*.***", createdAt: "2024-07-12T16:00:00Z" },
  { id: "AUD-2195", actor: "System", role: "System", action: "welcome_credit", entityType: "DriverPoints", entityId: "DRV-5102", oldValue: "balance: 0", newValue: "balance: 100", reason: "Welcome bonus on approval", ip: "internal", createdAt: "2024-07-13T19:50:00Z" },
  { id: "AUD-2194", actor: "R. Nakamura", role: "Admin", action: "approve_verification_a2", entityType: "VerificationRequest", entityId: "VRQ-2024-0889", oldValue: "status: pending", newValue: "status: completed", reason: null, ip: "41.190.*.***", createdAt: "2024-07-13T19:45:00Z" },
];

// ─── Ride trend (dashboard) ───────────────────────────────────────────────────

export const mockRideTrend = [
  { date: "Jul 8",  completed: 148, cancelled: 18, disputed: 2 },
  { date: "Jul 9",  completed: 162, cancelled: 14, disputed: 1 },
  { date: "Jul 10", completed: 141, cancelled: 21, disputed: 3 },
  { date: "Jul 11", completed: 175, cancelled: 12, disputed: 1 },
  { date: "Jul 12", completed: 158, cancelled: 16, disputed: 4 },
  { date: "Jul 13", completed: 169, cancelled: 11, disputed: 2 },
  { date: "Jul 14", completed: 74,  cancelled: 8,  disputed: 1 },
];

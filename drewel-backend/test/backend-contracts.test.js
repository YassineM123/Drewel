import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AVAILABLE_DRIVER_FIELDS,
  buildAvailableDriverFilter,
  buildProfileProposalSnapshot,
  canDriverSetOnlineStatus,
} from "../src/controllers/driverController.js";
import { sanitizeAuthSubject } from "../src/utils/authResponse.js";
import driverRoutes from "../src/routes/driverRoutes.js";
import userRoutes from "../src/routes/userRoutes.js";
import accountRoutes from "../src/routes/accountRoutes.js";
import { getLegalContent } from "../src/controllers/accountController.js";
import {
  configureMongoSrvDns,
  parseMongoDnsServers,
} from "../src/connection.js";
import { buildAuthSubjectLookupFilter } from "../src/controllers/authController.js";
import {
  buildAvailableDriverFilter as buildSharedAvailableDriverFilter,
  parseDriverDiscoveryQuery,
  toAvailableDriverDto,
} from "../src/utils/availableDrivers.js";
import Driver from "../src/models/Driver.js";
import Driverlogs from "../src/models/Driverlogs.js";

const routeLayer = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods?.[method]);
test("available-driver filter only returns online approved unrestricted drivers", () => {
  const filter = buildAvailableDriverFilter({
    city: "  Abu+Dhabi  ",
    vehicleType: "Small Pickup",
  });

  assert.equal(filter.isOnline, true);
  assert.equal(filter.isApproved, true);
  assert.equal(filter.isRestricted, false);
  assert.deepEqual(filter.isDeleted, { $ne: true });
  assert.deepEqual(filter.$or, [
    { status: "completed" },
    { status: null, profileRequestStatus: null },
  ]);
  assert.equal(filter.city.$regex.test("abu dhabi"), true);
  assert.equal(filter.city.$regex.test("Abu-Dhabi"), true);
  assert.equal(filter.city.$regex.test("Dubai"), false);
  assert.equal(filter.vehicleType.$regex.test("small pickup"), true);
  assert.equal(filter.vehicleType.$regex.test("small+pickup"), true);
  assert.equal(filter.vehicleType.$regex.test("small pickup plus"), false);
});

test("available-driver status compatibility only admits completed and pre-workflow legacy records", () => {
  const filter = buildSharedAvailableDriverFilter();
  const matchesStatus = (driver) =>
    filter.$or.some((clause) =>
      Object.entries(clause).every(([field, expected]) =>
        expected === null
          ? driver[field] === null || driver[field] === undefined
          : driver[field] === expected
      )
    );

  assert.equal(matchesStatus({ status: "completed", profileRequestStatus: "approved" }), true);
  assert.equal(matchesStatus({}), true);
  assert.equal(matchesStatus({ status: null, profileRequestStatus: null }), true);
  assert.equal(matchesStatus({ status: "approved", profileRequestStatus: "not_submitted" }), false);
  assert.equal(matchesStatus({ status: "pending", profileRequestStatus: "pending" }), false);
  assert.equal(matchesStatus({ status: "rejected", profileRequestStatus: "rejected" }), false);
  assert.equal(matchesStatus({ status: null, profileRequestStatus: "pending" }), false);
});

test("driver eligibility is enforced when going online but never blocks going offline", () => {
  const eligible = {
    status: "completed",
    isApproved: true,
    isRestricted: false,
    isDeleted: false,
  };
  assert.equal(canDriverSetOnlineStatus(eligible, true), true);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, status: "approved" }, true), false);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, isApproved: false }, true), false);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, isRestricted: true }, true), false);
  assert.equal(canDriverSetOnlineStatus({ ...eligible, isDeleted: true }, true), false);
  assert.equal(canDriverSetOnlineStatus({ status: "rejected" }, false), true);
  assert.equal(canDriverSetOnlineStatus({}, false), true);
});

test("profile proposal snapshots preserve unchanged documents and discard stale proposal values", () => {
  const driver = {
    _id: "driver-1",
    countryCode: "+971",
    phone: "5012345678",
    city: "Abu Dhabi",
    vehicleType: "Small Pickup",
    carLicenseFrontUrl: "approved-car-front.jpg",
    carLicenseBackUrl: "approved-car-back.jpg",
    idProofFrontUrl: "approved-id-front.jpg",
    idProofBackUrl: "approved-id-back.jpg",
    profileImageUrl: "approved-profile.jpg",
  };

  const firstProposal = buildProfileProposalSnapshot(driver, {
    city: "Dubai",
    carLicenseFrontUrl: "new-car-front.jpg",
  });

  assert.equal(firstProposal.city, "Dubai");
  assert.equal(firstProposal.carLicenseFrontUrl, "new-car-front.jpg");
  assert.equal(firstProposal.carLicenseBackUrl, "approved-car-back.jpg");
  assert.equal(firstProposal.idProofFrontUrl, "approved-id-front.jpg");
  assert.equal(firstProposal.idProofBackUrl, "approved-id-back.jpg");
  assert.equal(firstProposal.phone, "5012345678");

  const retryProposal = buildProfileProposalSnapshot(driver, {
    vehicleType: "Large Pickup",
  });

  assert.equal(retryProposal.city, "Abu Dhabi");
  assert.equal(retryProposal.vehicleType, "Large Pickup");
  assert.equal(retryProposal.carLicenseFrontUrl, "approved-car-front.jpg");
  assert.equal(retryProposal.carLicenseBackUrl, "approved-car-back.jpg");
});

test("pending profile amendments preserve the existing proposal snapshot", () => {
  const pendingProposal = {
    _id: "proposal-1",
    driverId: "driver-1",
    countryCode: "+971",
    phone: "5012345678",
    city: "Dubai",
    vehicleType: "Small Pickup",
    carLicenseFrontUrl: "pending-car-front.jpg",
    carLicenseBackUrl: "pending-car-back.jpg",
    idProofFrontUrl: "pending-id-front.jpg",
    idProofBackUrl: "pending-id-back.jpg",
  };

  const amendedProposal = buildProfileProposalSnapshot(pendingProposal, {
    city: "Sharjah",
    carLicenseFrontUrl: "replacement-car-front.jpg",
  });

  assert.equal(amendedProposal.city, "Sharjah");
  assert.equal(amendedProposal.vehicleType, "Small Pickup");
  assert.equal(amendedProposal.carLicenseFrontUrl, "replacement-car-front.jpg");
  assert.equal(amendedProposal.carLicenseBackUrl, "pending-car-back.jpg");
  assert.equal(amendedProposal.idProofFrontUrl, "pending-id-front.jpg");
  assert.equal(amendedProposal.idProofBackUrl, "pending-id-back.jpg");
});

test("available-driver matching is canonicalized across separators and casing", () => {
  const filter = buildSharedAvailableDriverFilter({
    city: "  Abu Dhabi  ",
    vehicleType: " Large+Pickup ",
  });

  assert.equal(filter.city.$regex.test("abu+dhabi"), true);
  assert.equal(filter.city.$regex.test("ABU-DHABI"), true);
  assert.equal(filter.city.$regex.test("Abu Dhabi East"), false);
  assert.equal(filter.vehicleType.$regex.test("large pickup"), true);
  assert.equal(filter.vehicleType.$regex.test("LARGE_PICKUP"), true);
  assert.equal(filter.vehicleType.$regex.test("large pickup plus"), false);
});

test("marketplace filters validate bounds and public DTO hides private registration", () => {
  assert.deepEqual(parseDriverDiscoveryQuery({
    lat: "36.8065",
    long: "10.1815",
    maxDistanceKm: "25",
    limit: "20",
  }), {
    lat: 36.8065,
    long: 10.1815,
    maxDistanceKm: 25,
    limit: 20,
  });
  assert.throws(() => parseDriverDiscoveryQuery({ lat: "91" }), /lat must be between/);
  assert.throws(
    () => parseDriverDiscoveryQuery({ minPrice: "20", maxPrice: "10" }),
    /minPrice cannot exceed/
  );
  assert.throws(
    () => parseDriverDiscoveryQuery({ availability: "offline" }),
    /availability must be/
  );
  const dto = toAvailableDriverDto({
    _id: "driver-1",
    firstName: "A",
    registration: "PRIVATE-123",
    registrationVisible: false,
    isOnline: true,
    availabilityStatus: "Online",
    lat: 36.8,
    long: 10.18,
  }, { lat: 36.81, long: 10.19 });
  assert.equal(dto.registration, null);
  assert.equal(dto.isAvailable, true);
  assert.equal(typeof dto.distanceKm, "number");
  for (const pii of ["phone", "countryCode", "whatsappNumber"]) {
    assert.equal(Object.hasOwn(dto, pii), false);
  }
});

test("controller preserves the shared available-driver filter contract", () => {
  assert.equal(buildAvailableDriverFilter, buildSharedAvailableDriverFilter);
});

test("socket discovery uses authenticated service-area rooms and geospatial initial results", () => {
  const source = readFileSync(
    new URL("../src/socket/index.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /discoveryRoom\(serviceArea, vehicleType\)/);
  assert.match(source, /buildDubaiDiscoveryAggregation\(\{ vehicleType \}, options, new Date\(\), serviceArea\)/);
  assert.match(source, /parseDriverDiscoveryQuery\(\{ lat, long, limit: 100 \}\)/);
  assert.match(source, /serviceAreaForCoordinates\(lat, long, 0, \{/);
  assert.match(source, /actorId: userId,[\s\S]*?actorType: "user"/);
  assert.doesNotMatch(source, /socket\.join\(normalizeVehicleRoom/);
  assert.match(source, /socket\.on\("leave-city-room"/);
  assert.match(source, /socket\.data\.discoveryRooms\s*=\s*\[\]/);
});

test("socket location tracking exposes post-auth readiness and event acknowledgements", () => {
  const source = readFileSync(
    new URL("../src/socket/index.js", import.meta.url),
    "utf8"
  );

  assert.match(
    source,
    /socket\.on\("driver-location-update",[\s\S]*?acknowledgeSocketEvent\(acknowledge, \{\s*ok: true,/
  );
  assert.match(
    source,
    /socket\.on\("join-city-room",[\s\S]*?acknowledgeSocketEvent\(acknowledge, \{\s*ok: true,/
  );
  assert.match(source, /socket\.on\("location-tracking-status"/);
  assert.match(source, /socket\.emit\("location-tracking-ready", \{ ready: true \}\)/);

  const driverHandlerIndex = source.indexOf('socket.on("driver-location-update"');
  const joinHandlerIndex = source.indexOf('socket.on("join-city-room"');
  const readyEventIndex = source.indexOf('socket.emit("location-tracking-ready"');
  assert.ok(driverHandlerIndex >= 0 && driverHandlerIndex < readyEventIndex);
  assert.ok(joinHandlerIndex >= 0 && joinHandlerIndex < readyEventIndex);
});

test("available-driver projection excludes OTP and private documents", () => {
  const fields = new Set(AVAILABLE_DRIVER_FIELDS.split(/\s+/));
  for (const privateField of [
    "otpCode",
    "password",
    "idDocumentUrl",
    "passportCopyUrl",
    "licenseDriverUrl",
    "licenseCarUrl",
  ]) {
    assert.equal(fields.has(privateField), false);
  }
  for (const personalField of ["phone", "countryCode", "whatsappNumber"]) {
    assert.equal(fields.has(personalField), false);
  }
  for (const mobileField of ["fullName", "lat", "long", "vehicleType"]) {
    assert.equal(fields.has(mobileField), true);
  }
});

test("authentication responses strip secrets without mutating source", () => {
  const source = { _id: "abc", phone: "123", otpCode: "999999", password: "hash" };
  const safe = sanitizeAuthSubject(source);

  assert.deepEqual(safe, { _id: "abc", phone: "123" });
  assert.equal(source.otpCode, "999999");
});

test("WhatsApp OTP driver login can resolve records by whatsappNumber", () => {
  const candidates = ["501234567", "971501234567"];

  assert.deepEqual(buildAuthSubjectLookupFilter("user", candidates), {
    phone: { $in: candidates },
  });
  assert.deepEqual(buildAuthSubjectLookupFilter("driver", candidates), {
    $or: [
      { phone: { $in: candidates } },
      { whatsappNumber: { $in: candidates } },
    ],
  });
  assert.equal(buildAuthSubjectLookupFilter("admin", candidates), null);
});

test("mobile available-driver endpoint requires authentication", () => {
  const layer = routeLayer(driverRoutes, "/available", "get");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "requireSignIn",
    "getAvailableDrivers",
  ]);
});

test("driver deletion preserves requests and profile staging joins the audit transaction", () => {
  const source = readFileSync(
    new URL("../src/controllers/driverController.js", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /Driver\.findByIdAndDelete/);
  assert.match(source, /isDeleted:\s*true/);
  assert.match(source, /DriverLogs\.findOneAndUpdate\([\s\S]*?session\s*}/);
});

test("user enumeration endpoint requires authentication and admin role", () => {
  const layer = routeLayer(userRoutes, "/get-all", "get");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "requireSignIn",
    "isAdmin",
    "getAllUsers",
  ]);
});

test("legal document endpoint is public and mounted before account authentication", () => {
  const layer = routeLayer(accountRoutes, "/legal/:type", "get");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "getLegalContent",
  ]);

  const indexSource = readFileSync(new URL("../index.js", import.meta.url), "utf8");
  assert.match(indexSource, /app\.use\("\/api\/account", accountRoutes\)/);
});

test("driver terms are supported by the public legal endpoint", () => {
  const source = readFileSync(
    new URL("../src/controllers/accountController.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /\["privacy",\s*"terms",\s*"driver-terms"\]/);
  assert.match(source, /DRIVER_TERMS_CONTENT/);
  assert.match(source, /DRIVER_TERMS_CONTENT_AR/);
  assert.match(source, /Driver Terms and Conditions/);
  assert.match(source, /شروط وأحكام السائق/);
  assert.match(source, /12\. Governing Law and Acceptance/);
  assert.match(source, /12\. القانون والموافقة/);
});

test("user terms expose the approved title and complete ten-clause default", async () => {
  const expectedBody = [
    "1. Use of the Application\nBy using Drewel or requesting any service, you agree to these Terms & Conditions and confirm that you will provide accurate information and use the application lawfully.",
    "2. User Account\nUsers are responsible for the accuracy and security of their account information. Sharing or misusing an account is prohibited.",
    "3. Services & Pricing\nServices are available depending on location and driver availability. Prices may vary depending on the type of service, distance, and other applicable factors.",
    "4. Payment\nThe service fee is paid directly to the driver upon completion of the service, according to the agreed price or the price displayed in the application.",
    "5. User Responsibilities\nUsers must provide accurate information about their location, vehicle, and cargo, treat drivers respectfully, and must not transport prohibited or dangerous materials.",
    "6. Cancellation\nUsers may cancel their request at any time without any cancellation fee.",
    "7. Safety & Conduct\nUsers must follow safety instructions, respect the driver, and avoid any behavior that may endanger people or the vehicle.",
    "8. Privacy\nUsers agree to the collection and use of information necessary to provide Drewel services, in accordance with the Privacy Policy and applicable UAE laws.",
    "9. Account Suspension\nDrewel may suspend or terminate an account in cases of fraud, misuse, false information, or violation of these Terms & Conditions.",
    "10. Governing Law & Acceptance\nThese Terms & Conditions are governed by the laws of the United Arab Emirates. By using Drewel or clicking \"I Agree to the Terms & Conditions\", the user confirms that they have read, understood, and accepted these Terms & Conditions.",
  ].join("\n\n");
  const previousUserTerms = process.env.USER_TERMS_CONTENT;
  delete process.env.USER_TERMS_CONTENT;
  let payload;

  try {
    await getLegalContent(
      { params: { type: "terms" }, query: { language: "en" } },
      {
        json: (value) => {
          payload = value;
        },
      }
    );
  } finally {
    if (previousUserTerms === undefined) {
      delete process.env.USER_TERMS_CONTENT;
    } else {
      process.env.USER_TERMS_CONTENT = previousUserTerms;
    }
  }

  assert.equal(payload.success, true);
  assert.equal(payload.legal.type, "terms");
  assert.equal(payload.legal.title, "Drewel – User Terms & Conditions");
  assert.equal(payload.legal.body, expectedBody);
});

test("legal environment sample documents user, driver, and privacy content keys", () => {
  const source = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

  assert.match(source, /^PRIVACY_CONTENT=/m);
  assert.match(source, /^USER_TERMS_CONTENT=/m);
  assert.match(source, /^USER_TERMS_CONTENT_AR=/m);
  assert.match(source, /^DRIVER_TERMS_CONTENT=/m);
  assert.match(source, /^DRIVER_TERMS_CONTENT_AR=/m);
  assert.doesNotMatch(source, /^TERMS_CONTENT=/m);
});

test("MongoDB SRV DNS override is opt-in and parses multiple resolvers", () => {
  assert.deepEqual(parseMongoDnsServers(" 1.1.1.1, 8.8.8.8 ,, "), [
    "1.1.1.1",
    "8.8.8.8",
  ]);

  const calls = [];
  const adapter = { setServers: (servers) => calls.push(servers) };
  assert.deepEqual(
    configureMongoSrvDns("mongodb+srv://cluster.example", "1.1.1.1,8.8.8.8", adapter),
    ["1.1.1.1", "8.8.8.8"]
  );
  assert.deepEqual(calls, [["1.1.1.1", "8.8.8.8"]]);

  assert.deepEqual(
    configureMongoSrvDns("mongodb://localhost:27017", "1.1.1.1", adapter),
    []
  );
  assert.equal(calls.length, 1);
});

test("MongoDB SRV DNS override reports invalid resolver configuration", () => {
  const adapter = {
    setServers: () => {
      throw new Error("invalid IP address");
    },
  };
  assert.throws(
    () => configureMongoSrvDns("mongodb+srv://cluster.example", "not-an-ip", adapter),
    /Invalid MONGO_DNS_SERVERS configuration/
  );
});

test("startup creates and verifies required marketplace geospatial indexes", () => {
  const connectionSource = readFileSync(
    new URL("../src/connection.js", import.meta.url),
    "utf8"
  );
  const driverSource = readFileSync(
    new URL("../src/models/Driver.js", import.meta.url),
    "utf8"
  );
  assert.match(connectionSource, /await ensureMarketplaceDriverIndexes\(\)/);
  assert.match(driverSource, /createIndex\([\s\S]*?currentLocation:\s*"2dsphere"/);
  assert.match(driverSource, /indexes\(\)[\s\S]*?Required marketplace index is missing/);
});

test("driver action-time availability paths reuse fresh Dubai GPS eligibility", () => {
  for (const relativePath of [
    "../src/controllers/rideController.js",
    "../src/services/tripOfferService.js",
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /buildFreshDubaiMarketplaceAvailabilityFilter\(\)/);
  }
  const driverSource = readFileSync(
    new URL("../src/controllers/driverController.js", import.meta.url),
    "utf8"
  );
  assert.match(
    driverSource,
    /getDriverAvailability[\s\S]*?buildFreshMarketplaceAvailabilityFilter\([\s\S]*?DUBAI_SERVICE_AREA/
  );
});

test("ride messages allow only passengers to send trip requests", () => {
  const rideController = readFileSync(
    new URL("../src/controllers/rideController.js", import.meta.url),
    "utf8"
  );
  const sendStart = rideController.indexOf("export const sendRideMessage");
  const sendEnd = rideController.indexOf("const messageEvent", sendStart);
  const sendBlock = rideController.slice(sendStart, sendEnd);
  assert.match(sendBlock, /\["text", "trip_request"\]\.includes\(messageType\)/);
  assert.match(sendBlock, /messageType === "trip_request"[\s\S]*?participantRole !== "passenger"/);
  assert.match(sendBlock, /PASSENGER_REQUIRED/);
});

test("trip requests are cancelled after supersede or driver offer", () => {
  const rideController = readFileSync(
    new URL("../src/controllers/rideController.js", import.meta.url),
    "utf8"
  );
  assert.match(rideController, /cancelSupersededTripRequests/);
  assert.match(rideController, /cancellationReason:\s*"superseded"/);

  const offerService = readFileSync(
    new URL("../src/services/tripOfferService.js", import.meta.url),
    "utf8"
  );
  assert.match(offerService, /RideMessage\.updateMany/);
  assert.match(offerService, /messageType:\s*"trip_request"/);
  assert.match(offerService, /cancellationReason:\s*"offer_sent"/);
});

test("driver schema permits empty string email and validates valid/invalid emails", () => {
  const emptyEmailDriver = new Driver({ phone: "501234567", email: "" });
  const emptyEmailErr = emptyEmailDriver.validateSync(["email", "phone"]);
  assert.equal(emptyEmailErr, undefined);

  const defaultEmailDriver = new Driver({ phone: "501234567" });
  const defaultEmailErr = defaultEmailDriver.validateSync(["email", "phone"]);
  assert.equal(defaultEmailErr, undefined);

  const validEmailDriver = new Driver({ phone: "501234567", email: "driver@example.com" });
  const validEmailErr = validEmailDriver.validateSync(["email", "phone"]);
  assert.equal(validEmailErr, undefined);

  const invalidEmailDriver = new Driver({ phone: "501234567", email: "not-an-email" });
  const invalidEmailErr = invalidEmailDriver.validateSync(["email"]);
  assert.ok(invalidEmailErr?.errors?.email);
});

test("driverlogs schema permits international phone numbers and empty email", () => {
  const driverLogs = new Driverlogs({
    driverId: "69ca8d07657eef3a66dd6a12",
    phone: "501234567",
    email: "",
  });
  const err = driverLogs.validateSync(["phone", "email"]);
  assert.equal(err, undefined);
});

test("user delete endpoint requires authentication and supports admin roles and token cleanup", () => {
  const layer = routeLayer(userRoutes, "/:id", "delete");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "requireSignIn",
    "deleteUser",
  ]);

  const userController = readFileSync(
    new URL("../src/controllers/userController.js", import.meta.url),
    "utf8"
  );
  assert.match(userController, /\["owner",\s*"finance_admin",\s*"admin"\]/);
  assert.match(userController, /DeviceToken\.deleteMany/);
});

test("driver delete endpoint requires authentication and supports admin roles and token cleanup", () => {
  const layer = routeLayer(driverRoutes, "/:driverId", "delete");
  assert.ok(layer);
  assert.deepEqual(layer.route.stack.map((handler) => handler.handle.name), [
    "requireSignIn",
    "deleteDriver",
  ]);

  const driverController = readFileSync(
    new URL("../src/controllers/driverController.js", import.meta.url),
    "utf8"
  );
  assert.match(driverController, /\["owner",\s*"finance_admin",\s*"admin"\]/);
  assert.match(driverController, /DeviceToken\.deleteMany/);
});


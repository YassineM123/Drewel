import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readProjectFile = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("socket readiness is emitted only after realtime handlers are registered", () => {
  const source = readProjectFile("drewel-backend/src/socket/index.js");
  const readinessIndex = source.lastIndexOf('socket.emit("location-tracking-ready"');

  assert.ok(readinessIndex > source.indexOf('socket.on("driver-location-update"'));
  assert.ok(readinessIndex > source.indexOf('socket.on("join-city-room"'));
  assert.ok(readinessIndex > source.indexOf('socket.on("location-tracking-status"'));
  assert.match(source, /socket\.emit\("location-tracking-ready",\s*\{\s*ready:\s*true\s*\}\)/);
});

test("realtime location commands provide success and structured error acknowledgements", () => {
  const source = readProjectFile("drewel-backend/src/socket/index.js");

  assert.match(
    source,
    /socket\.on\("driver-location-update",[\s\S]*?acknowledgeSocketEvent\(acknowledge,\s*\{\s*ok:\s*true,[\s\S]*?driverId:[\s\S]*?updatedAt:/
  );
  assert.match(source, /driver-location-update[\s\S]*?accuracyM[\s\S]*?recordedAt/);
  assert.match(
    source,
    /buildDriverLocationUpdate\([\s\S]*?\{ lat, long, accuracyM, recordedAt \},[\s\S]*?\{ actorId: targetDriverId \}/
  );
  assert.match(
    source,
    /socket\.on\("join-city-room",[\s\S]*?acknowledgeSocketEvent\(acknowledge,\s*\{\s*ok:\s*true,\s*count:/
  );
  assert.match(source, /ok:\s*false,\s*error:/);
});

test("active ride driver GPS is broadcast to the admin tracking room", () => {
  const socketSource = readProjectFile("drewel-backend/src/socket/index.js");
  const rideSource = readProjectFile("drewel-backend/src/controllers/rideController.js");

  for (const source of [socketSource, rideSource]) {
    assert.match(source, /ADMIN_TRACKING_ROOM/);
    assert.match(
      source,
      /io\.to\(ADMIN_TRACKING_ROOM\)\.emit\("driver:location",\s*\{[\s\S]*?driverId:[\s\S]*?lat:[\s\S]*?long:[\s\S]*?rideId:/
    );
  }
});

test("mobile socket retains the latest driver fix and resends after server readiness", () => {
  const source = readProjectFile("lib/common/socket_services.dart");

  assert.match(source, /Map<String,\s*dynamic>\?\s+_pendingDriverLocation/);
  assert.match(source, /['"]location-tracking-ready['"]/);
  assert.match(
    source,
    /location-tracking-ready[\s\S]*?_flushPendingDriverLocation\(\)/
  );
  assert.match(
    source,
    /_flushPendingDriverLocation\(\)[\s\S]*?_pendingDriverLocation[\s\S]*?driver-location-update/
  );
  assert.match(source, /['"]disconnect['"][\s\S]*?_locationTrackingReady\s*=\s*false/);
});

test("mobile sockets back off during network loss and stop while backgrounded", () => {
  const socketSource = readProjectFile("lib/common/socket_services.dart");
  const driverSource = readProjectFile(
    "lib/app/modules/driver_home/controllers/driver_home_controller.dart"
  );
  const callSource = readProjectFile(
    "lib/app/modules/communication/controllers/call_state_controller.dart"
  );

  assert.match(socketSource, /\.setReconnectionDelayMax\(30000\)/);
  assert.match(socketSource, /_connectionErrorLogInterval/);
  assert.match(
    driverSource,
    /AppLifecycleState\.paused[\s\S]*?socketService\.disconnect\(\)/
  );
  assert.match(callSource, /with WidgetsBindingObserver/);
  assert.match(
    callSource,
    /AppLifecycleState\.paused[\s\S]*?_socketService\.disconnect\(\)/
  );
  assert.match(
    callSource,
    /AppLifecycleState\.resumed[\s\S]*?_sessionToken\s*=\s*''[\s\S]*?configureSession\(\)/
  );
});

test("accepted driver GPS movement is pushed immediately and stationary heartbeats use fresh fixes", () => {
  const source = readProjectFile(
    "lib/app/modules/driver_home/controllers/driver_home_controller.dart"
  );

  assert.match(source, /Timer\.periodic\([\s\S]*?_refreshLocationHeartbeat\(\)/);
  assert.match(
    source,
    /_refreshLocationHeartbeat\(\)[\s\S]*?Geolocator\.getCurrentPosition\([\s\S]*?_applyDriverPosition\([\s\S]*?_emitCurrentLocation\(\)/
  );
  assert.match(source, /emitRealtimeOnMovement:\s*false/);
  assert.match(
    source,
    /if \(hasPositionChanged\) \{[\s\S]*?if \(_isDriverOnline && emitRealtimeOnMovement\) \{[\s\S]*?_emitCurrentLocation\(\)/
  );
  assert.match(
    source,
    /AndroidSettings\([\s\S]*?distanceFilter:\s*0,[\s\S]*?intervalDuration:\s*(?:const\s+)?Duration\([\s\S]*?seconds:\s*_locationUpdateIntervalSeconds/
  );
  assert.match(
    source,
    /Geolocator\.getPositionStream[\s\S]*?emitRealtimeOnMovement:\s*false[\s\S]*?if \(_isDriverOnline\) _emitCurrentLocation\(\)/
  );
});

test("new clients go online with GPS while legacy clients remain hidden until a fresh fix", () => {
  const driverSource = readProjectFile("drewel-backend/src/controllers/driverController.js");
  const mobileSource = readProjectFile(
    "lib/app/modules/driver_home/controllers/driver_home_controller.dart"
  );
  const adminSource = readProjectFile("drewel-backend/src/controllers/adminController.js");
  const dashboardSource = readProjectFile("drewel-backend/src/controllers/userController.js");

  assert.match(
    driverSource,
    /updateOnlineStatus[\s\S]*?hasLocationPayload[\s\S]*?if \(isOnline && hasLocationPayload\)[\s\S]*?buildDriverLocationUpdate\(req\.body \|\| \{\}, new Date\(\), \{[\s\S]*?actorId: req\.user\?\._id[\s\S]*?if \(!locationUpdate\.currentServiceArea\)/
  );
  assert.match(driverSource, /isOnline && !locationUpdate[\s\S]*?LOCATION_PENDING/);
  assert.match(
    mobileSource,
    /callingUpdateDriverOnlineStatus\(\)[\s\S]*?Geolocator\.getCurrentPosition\([\s\S]*?buildGpsFixPayload\([\s\S]*?driverUpdateOnlineStatusApi/
  );
  assert.match(adminSource, /Driver\.find\(\{[\s\S]*?buildActiveDriverPresenceFilter\(\)/);
  assert.match(dashboardSource, /Driver\.countDocuments\(buildActiveDriverPresenceFilter\(\)\)/);
});

test("map driver marker identity is based on driver id, not list position", () => {
  const source = readProjectFile(
    "lib/app/modules/user_home/controllers/user_home_controller.dart"
  );

  assert.doesNotMatch(source, /MarkerId\(['"]driver_\$i['"]\)/);
  assert.match(source, /MarkerId\([\s\S]{0,250}driver\.sId/);
});

test("Find Now uses the selected UAE place for REST and realtime discovery", () => {
  const source = readProjectFile(
    "lib/app/modules/user_home/controllers/user_home_controller.dart"
  );
  const socketSource = readProjectFile("lib/common/socket_services.dart");

  assert.match(
    source,
    /_initializeDiscovery\(\)[\s\S]*?if \(!hasReferenceLocation\)[\s\S]*?await checkPermission\(\)[\s\S]*?await callingGetAllDriverListApi\(\)/
  );
  assert.match(
    source,
    /getAllDriverListApi\([\s\S]*?city:\s*parameter\[ApiKeyConstants\.city\][\s\S]*?latitude:\s*hasReferenceLocation\s*\?\s*referenceLocation\.latitude\s*:\s*null[\s\S]*?longitude:\s*hasReferenceLocation\s*\?\s*referenceLocation\.longitude\s*:\s*null/
  );
  assert.match(
    source,
    /emitJoinCityRoom\([\s\S]*?latitude:\s*hasReferenceLocation\s*\?\s*referenceLocation\.latitude\s*:\s*null[\s\S]*?longitude:\s*hasReferenceLocation\s*\?\s*referenceLocation\.longitude\s*:\s*null/
  );
  assert.match(
    source,
    /_refreshDiscoveryForReferenceLocation\([\s\S]*?callingGetAllDriverListApi\([\s\S]*?showError:\s*false[\s\S]*?socketService\.isConnected[\s\S]*?_joinRealtimeTrackingRoom\(\)/
  );
  assert.match(
    source,
    /setSelectedLocation\(LatLng location\)[\s\S]*?filterDriversByVisibleBounds\(\);[\s\S]*?_refreshDiscoveryForReferenceLocation\(showLoader:\s*true\)/
  );
  assert.match(
    source,
    /clickOnLocation\(Prediction prediction\)[\s\S]*?isSelectedLocationSet\.value = true;[\s\S]*?filterDriversByVisibleBounds\(\);[\s\S]*?_refreshDiscoveryForReferenceLocation\(showLoader:\s*true\)/
  );
  assert.match(
    source,
    /setSelectedCityLocation\(LatLng latLong, String city\)[\s\S]*?selectedLocationLat\.value = latLong\.latitude[\s\S]*?selectedLocationLng\.value = latLong\.longitude[\s\S]*?isSelectedLocationSet\.value = true/
  );
  assert.match(socketSource, /if \(latitude != null\) 'lat': latitude/);
  assert.match(socketSource, /if \(longitude != null\) 'long': longitude/);
  assert.doesNotMatch(source, /regionalDriverFallback|regionalDriverMessage/);
  assert.doesNotMatch(source, /city:\s*''/);
});

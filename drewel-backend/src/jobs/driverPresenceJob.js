import { io } from "../socket/index.js";
import {
  expireStaleDriverPresences,
  getDriverPresenceConfig,
  seedRecentLegacyDriverPresences,
} from "../services/driverPresenceService.js";

let timer = null;

export const startDriverPresenceWatchdog = () => {
  if (timer) return timer;
  const { sweepIntervalMs } = getDriverPresenceConfig();
  const sweep = () =>
    expireStaleDriverPresences({
      emit: (event, driver) => {
        io.emit("driver:presence", event);
        io.emit("driver:availability", {
          driverId: String(driver._id),
          status: driver.availabilityStatus,
          isAvailable: false,
          updatedAt: driver.updatedAt,
        });
      },
    }).catch((error) => console.error("Driver presence sweep failed:", error.message));
  timer = setInterval(sweep, sweepIntervalMs);
  timer.unref?.();
  seedRecentLegacyDriverPresences()
    .then(sweep)
    .catch((error) => console.error("Legacy driver presence seed failed:", error.message));
  return timer;
};

export const stopDriverPresenceWatchdog = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

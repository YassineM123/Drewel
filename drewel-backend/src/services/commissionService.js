/**
 * Centralized commission calculation service.
 *
 * All commission math across the backend MUST go through this module.
 * Frontend clients should display backend-calculated values only.
 *
 * Formula:
 *   commissionAED  = ridePriceAED * commissionRate
 *   balanceToDeduct = commissionAED
 *
 * Defaults:
 *   commissionRate = 10% (0.10)
 * Balance units are AED-aligned for commission charging: a 200 AED ride
 * deducts 20 balance units at the default 10% commission rate.
 */

/**
 * Calculate commission for a given ride price using the provided settings.
 *
 * @param {number} ridePriceAED - final ride price in AED (must be > 0)
 * @param {object} settings - pre-fetched PointsSettings.getEffective() result
 * @returns {object} commission breakdown
 */
export const calculateRideCommission = (ridePriceAED, settings) => {
  if (!Number.isFinite(ridePriceAED) || ridePriceAED <= 0) {
    throw new Error("ridePriceAED must be a positive finite number");
  }

  const commissionRate = settings?.commissionRate ?? 0.10;
  const pointsPerAED = settings?.pointsPerAED ?? 10;

  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    throw new Error("commissionRate must be between 0 and 1");
  }
  if (!Number.isFinite(pointsPerAED) || pointsPerAED <= 0) {
    throw new Error("pointsPerAED must be a positive number");
  }

  const commissionAED = ridePriceAED * commissionRate;
  const pointsToDeduct = commissionAED;
  const driverNetAED = ridePriceAED - commissionAED;

  return {
    ridePriceAED: Math.round(ridePriceAED * 100) / 100,
    commissionRate,
    commissionAED: Math.round(commissionAED * 100) / 100,
    pointsPerAED,
    pointsToDeduct: Math.ceil(pointsToDeduct * 100) / 100,
    driverNetAED: Math.round(driverNetAED * 100) / 100,
  };
};

/**
 * Calculate the minimum integer points a driver needs to cover a ride's
 * commission. Used for pre-acceptance balance validation.
 *
 * @param {number} ridePriceAED - estimated ride price
 * @param {object} settings - pre-fetched settings
 * @returns {number} ceiling of points required
 */
export const estimateCommissionPoints = (ridePriceAED, settings) => {
  const { pointsToDeduct } = calculateRideCommission(ridePriceAED, settings);
  return Math.ceil(pointsToDeduct);
};

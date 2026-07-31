import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import PointsSettings, {
  DEFAULT_MAXIMUM_CONCURRENT_OFFERS,
  DEFAULT_POINTS_LARGE_ADJUSTMENT_THRESHOLD,
  DEFAULT_POINTS_LOW_BALANCE_THRESHOLD,
  DEFAULT_TRIP_OFFER_EXPIRATION_SECONDS,
} from "../src/models/PointsSettings.js";
import { updatePointSettings } from "../src/controllers/adminPointsController.js";

const responseRecorder = () => {
  const result = { statusCode: 200, body: null };
  return {
    result,
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
};

test("runtime point settings expose safe server defaults", async () => {
  const settings = new PointsSettings();
  assert.equal(settings.lowBalanceThreshold, DEFAULT_POINTS_LOW_BALANCE_THRESHOLD);
  assert.equal(
    settings.offerExpirationSeconds,
    DEFAULT_TRIP_OFFER_EXPIRATION_SECONDS
  );
  assert.equal(
    settings.maximumConcurrentOffers,
    DEFAULT_MAXIMUM_CONCURRENT_OFFERS
  );
  assert.equal(
    settings.largeAdjustmentThreshold,
    DEFAULT_POINTS_LARGE_ADJUSTMENT_THRESHOLD
  );
  await settings.validate();
});

test("settings PATCH updates only provided runtime fields", async () => {
  const source = await readFile(
    new URL("../src/controllers/adminPointsController.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /if \(req\.body\?\.\[fieldName\] !== undefined\)/);
  assert.match(source, /\$set:\s*\{\s*\.\.\.values,/);
  assert.match(source, /At least one point setting must be provided/);
});

test("settings PATCH rejects unsafe offer expiration bounds", async () => {
  const res = responseRecorder();
  await updatePointSettings(
    {
      body: {
        offerExpirationSeconds: 10,
        reason: "Unsafe short expiration",
        confirmation: true,
      },
      pointsAdmin: { id: "admin-1" },
    },
    res
  );
  assert.equal(res.result.statusCode, 400);
  assert.equal(res.result.body.code, "POINTS_VALIDATION_ERROR");
});

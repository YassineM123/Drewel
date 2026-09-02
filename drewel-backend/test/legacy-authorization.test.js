import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("legacy expense and friend reads require authentication", () => {
  const expenseRoutes = readSource("../src/routes/expenseRoutes.js");
  const friendRoutes = readSource("../src/routes/friendRoute.js");

  assert.match(expenseRoutes, /router\.get\("\/:id", requireSignIn, getExpenseById\)/);
  assert.match(friendRoutes, /router\.get\('\/friend-list\/:userId', requireSignIn, getFriendsList\)/);
});

test("legacy expense queries are participant scoped and mutations are owner scoped", () => {
  const source = readSource("../src/controllers/expenseController.js");

  assert.match(source, /\$or: \[\{ paidBy: userId \}, \{ groupId: \{ \$in: groupIds \} \}]/);
  assert.match(source, /Expense\.find\(filter\)/);
  assert.match(source, /Expense\.findOne\(filter\)/);
  assert.match(source, /Expense\.findOneAndUpdate\([\s\S]*paidBy: req\.user\._id/);
  assert.match(source, /Expense\.findOneAndDelete\(\{[\s\S]*paidBy: req\.user\._id/);
  assert.doesNotMatch(source, /findByIdAndUpdate\([\s\S]*req\.body/);
});

test("friend lists are owner scoped and errors never report success", () => {
  const source = readSource("../src/controllers/friendController.js");

  assert.match(source, /String\(req\.user\?\._id\) !== String\(userId\)/);
  assert.doesNotMatch(source, /status\(500\)[\s\S]{0,80}success: true/);
});

test("device-token administration requires the admin role", () => {
  const source = readSource("../src/routes/deviceTokenRoutes.js");
  assert.match(source, /router\.get\("\/admin\/:userId", requireSignIn, isAdmin, adminList\)/);
});

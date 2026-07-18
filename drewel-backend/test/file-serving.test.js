import test from "node:test";
import assert from "node:assert/strict";
import { serveUploadedFile } from "../src/utils/fileServing.js";

const createResponse = () => {
  const headers = new Map();
  return {
    headers,
    statusCode: 200,
    body: null,
    sentFile: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    sendFile(value) {
      this.sentFile = value;
      return this;
    },
  };
};

test("private document serving sets no-store, nosniff, and attachment headers", async () => {
  const response = createResponse();
  await serveUploadedFile({
    res: response,
    fileName: "identity.pdf",
    // package.json is used only as an existing test path; serving is mocked.
    localPaths: [new URL("../package.json", import.meta.url).pathname.replace(/^\/(.:)/, "$1")],
    disposition: "attachment",
    cacheControl: "no-store",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers.get("content-disposition"), /^attachment;/);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("file serving rejects unsupported document types before filesystem access", async () => {
  const response = createResponse();
  await serveUploadedFile({ res: response, fileName: "payload.svg", localPaths: [] });
  assert.equal(response.statusCode, 415);
  assert.equal(response.body, "Unsupported file type");
});

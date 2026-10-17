import { describe, expect, it } from "vitest";

import { MAX_JSON_REQUEST_BYTES, readJsonRequest } from "./json-request";

const requestFor = (body: BodyInit, contentType = "application/json") =>
  new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

describe("bounded JSON request reader", () => {
  it("parses JSON with a charset parameter", async () => {
    await expect(
      readJsonRequest(
        requestFor('{"synthetic":true}', "application/json; charset=utf-8"),
      ),
    ).resolves.toEqual({ status: "ok", value: { synthetic: true } });
  });

  it("distinguishes unsupported media and malformed JSON", async () => {
    await expect(
      readJsonRequest(requestFor("{}", "text/plain")),
    ).resolves.toEqual({ status: "unsupported_media_type" });
    await expect(readJsonRequest(requestFor("{"))).resolves.toEqual({
      status: "malformed_json",
    });
  });

  it("rejects a declared oversized request before parsing", async () => {
    const request = requestFor("{");
    request.headers.set("content-length", String(MAX_JSON_REQUEST_BYTES + 1));

    await expect(readJsonRequest(request)).resolves.toEqual({
      status: "too_large",
    });
  });

  it("cancels an undeclared stream as soon as it exceeds the byte limit", async () => {
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(8 * 1024));
        if (pulls === 64) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJsonRequest(request)).resolves.toEqual({
      status: "too_large",
    });
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(64);
  });

  it("rejects invalid UTF-8 without exposing decoder details", async () => {
    const invalid = new Uint8Array([0xc3, 0x28]);

    await expect(readJsonRequest(requestFor(invalid))).resolves.toEqual({
      status: "malformed_json",
    });
  });
});

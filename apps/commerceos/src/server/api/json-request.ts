export const MAX_JSON_REQUEST_BYTES = 16 * 1024;

export type JsonRequestReadResult =
  | { status: "ok"; value: unknown }
  | { status: "malformed_json" }
  | { status: "too_large" }
  | { status: "unsupported_media_type" };

export const readJsonRequest = async (
  request: Request,
): Promise<JsonRequestReadResult> => {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return { status: "unsupported_media_type" };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_JSON_REQUEST_BYTES
  ) {
    return { status: "too_large" };
  }

  if (!request.body) return { status: "malformed_json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_JSON_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { status: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { status: "malformed_json" };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return { status: "ok", value: JSON.parse(text) };
  } catch {
    return { status: "malformed_json" };
  }
};

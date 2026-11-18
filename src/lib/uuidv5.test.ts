import { describe, expect, it } from "vitest";
import { uuidv5 } from "@/lib/uuidv5";

describe("uuidv5", () => {
  it("produce un UUID con formato canónico", () => {
    const u = uuidv5("a57e4f1c-9b3d-4c2e-8f60-1d2b3c4d5e6f", "order:AV-1048");
    expect(u).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("es determinístico", () => {
    const a = uuidv5("a57e4f1c-9b3d-4c2e-8f60-1d2b3c4d5e6f", "order:AV-1048");
    const b = uuidv5("a57e4f1c-9b3d-4c2e-8f60-1d2b3c4d5e6f", "order:AV-1048");
    expect(a).toBe(b);
  });

  it("difiere para nombres distintos", () => {
    const a = uuidv5("a57e4f1c-9b3d-4c2e-8f60-1d2b3c4d5e6f", "order:AV-1048");
    const b = uuidv5("a57e4f1c-9b3d-4c2e-8f60-1d2b3c4d5e6f", "order:AV-1049");
    expect(a).not.toBe(b);
  });

  it("SHA-1 puro coincide con node:crypto", async () => {
    const { sha1Bytes } = await import("@/lib/uuidv5");
    const crypto = await import("node:crypto");
    for (const txt of ["", "abc", "hello world", "AV-1048", "a".repeat(100)]) {
      const mine = Array.from(sha1Bytes(new TextEncoder().encode(txt)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const node = crypto.createHash("sha1").update(txt).digest("hex");
      expect(mine).toBe(node);
    }
  });
});

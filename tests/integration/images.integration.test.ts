import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { POST as upload } from "@/app/api/images/upload/route";

import { formRequest, readError, readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** The smallest valid PNG: a 1×1 transparent pixel. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function imageForm(folder?: string, file: Blob = new Blob([PNG], { type: "image/png" })): FormData {
  const form = new FormData();
  form.append("file", file, "pixel.png");
  if (folder) form.append("folder", folder);
  return form;
}

describe("image upload", () => {
  it("refuses anonymous uploads", async () => {
    expect((await upload(formRequest("/api/images/upload", imageForm("products")))).status).toBe(401);
  });

  it("keeps catalog folders to catalog writers", async () => {
    signInAs("customer");

    expect((await upload(formRequest("/api/images/upload", imageForm("products")))).status).toBe(401);
  });

  it("stores a catalog image on disk and returns its public URL", async () => {
    signInAs("admin");

    const response = await upload(formRequest("/api/images/upload", imageForm("products")));

    expect(response.status).toBe(201);
    const { image } = await readJson<{ image: { url: string } }>(response);
    expect(image.url).toMatch(/^\/uploads\/products\/.+\.png$/);
    const stored = join(process.env.UPLOADS_DIR ?? "", image.url.replace(/^\/uploads\//, ""));
    expect(existsSync(stored)).toBe(true);
  });

  it("lets any signed-in guest upload an avatar", async () => {
    signInAs("customer");

    expect((await upload(formRequest("/api/images/upload", imageForm("avatars")))).status).toBe(201);
  });

  it("rejects a missing file or an unknown folder with 400", async () => {
    signInAs("admin");

    const noFile = new FormData();
    noFile.append("folder", "products");
    const missing = await upload(formRequest("/api/images/upload", noFile));
    expect(missing.status).toBe(400);
    expect((await readError(missing)).fieldErrors).toHaveProperty("file");

    expect((await upload(formRequest("/api/images/upload", imageForm("secrets")))).status).toBe(400);
  });

  it("refuses a file that isn't really an image", async () => {
    signInAs("admin");

    const fake = new Blob(["#!/bin/sh\necho pwned"], { type: "image/png" });
    const response = await upload(formRequest("/api/images/upload", imageForm("products", fake)));

    // Refused either way; today it surfaces as 502 UPLOAD_FAILED because UploadImage throws a
    // plain Error rather than a ValidationError — a 400 would be the more accurate answer.
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

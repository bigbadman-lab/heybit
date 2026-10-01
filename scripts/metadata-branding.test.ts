import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("site metadata uses the approved preview image and favicon", () => {
  const layout = readFileSync(new URL("../apps/web/app/layout.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  assert.match(layout, /title: "HEYBIT — foundation"/);
  assert.match(layout, /description: "Phase 1 development foundation. This is not the live BIT site."/);
  assert.match(home, /title: "HEYBIT"/);
  assert.match(home, /description: "BIT is waking up."/);
  assert.equal(layout.split("openGraph").length - 1, 1);
  assert.match(layout, /images: \["\/brand\/bitmeta\.jpg"\]/);
  assert.match(layout, /card: "summary_large_image"/);
  assert.match(layout, /icon: "\/brand\/bitmain2\.png"/);
  assert.equal(home.includes("openGraph"), false);
  assert.equal(existsSync(new URL("../apps/web/app/icon.png", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/app/favicon.ico", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/public/brand/bitmeta.jpg", import.meta.url)), true);
  assert.equal(existsSync(new URL("../apps/web/public/brand/bitmain2.png", import.meta.url)), true);
});

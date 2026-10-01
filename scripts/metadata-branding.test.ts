import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("site metadata uses the approved preview image and favicon", () => {
  const layout = readFileSync(new URL("../apps/web/app/layout.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const manifest = readFileSync(new URL("../config/env-manifest.json", import.meta.url), "utf8");
  assert.match(layout, /metadataBase: new URL\("https:\/\/heybit\.fun"\)/);
  assert.equal(layout.includes("http://localhost:3000"), false);
  for (const name of ["NEXT_PUBLIC_SITE_URL", "SITE_URL", "METADATA_BASE_URL"]) {
    assert.equal(layout.includes(name), false, name);
    assert.equal(manifest.includes(name), false, name);
  }
  assert.match(layout, /title: "HEYBIT — foundation"/);
  assert.match(layout, /description: "Phase 1 development foundation. This is not the live BIT site."/);
  assert.match(home, /title: "HEYBIT"/);
  assert.match(home, /description: "BIT is waking up."/);
  assert.equal(layout.split("openGraph").length - 1, 1);
  assert.equal(layout.split('"/brand/bitmeta.jpg"').length - 1, 2);
  assert.match(layout, /card: "summary_large_image"/);
  assert.match(layout, /icon: "\/brand\/bitmain2\.png"/);
  assert.equal(home.includes("openGraph"), false);
  assert.equal(existsSync(new URL("../apps/web/app/icon.png", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/app/favicon.ico", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/public/brand/bitmeta.jpg", import.meta.url)), true);
  assert.equal(existsSync(new URL("../apps/web/public/brand/bitmain2.png", import.meta.url)), true);
});

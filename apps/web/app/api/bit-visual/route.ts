import { readBitVisualFeed } from "../../../lib/bit-visual-feed";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const source = await readBitVisualFeed();
  if (!source) {
    return Response.json(
      { available: false, events: [], busy: false, intensity: 0 },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { available: true, ...source },
    { headers: { "cache-control": "no-store" } },
  );
}

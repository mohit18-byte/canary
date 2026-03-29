/**
 * GET /api/changes — Fetch persisted scan results
 *
 * Returns latest classified changes from the database.
 * Query params:
 *   ?limit=N   (default 50)
 *   ?provider=name  (optional filter)
 */

import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const provider = searchParams.get("provider");

  let query = supabase
    .from("changes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (provider) {
    query = query.eq("provider_name", provider);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Also fetch last scan time
  const { data: lastScan } = await supabase
    .from("scans")
    .select("completed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  return Response.json({
    changes: data ?? [],
    lastScanAt: lastScan?.completed_at ?? null,
  });
}

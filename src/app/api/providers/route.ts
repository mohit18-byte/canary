/**
 * /api/providers — CRUD for providers
 *
 * GET: Fetch all providers from database
 * POST: Add a new custom provider
 * DELETE: Remove a custom provider (by slug in query param)
 */

import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
    .from("providers")
    .select("id, name, slug, changelog_url, deprecation_url, status_url, is_custom")
    .order("is_custom", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ providers: data ?? [] });
}

export async function POST(request: Request) {
  let name: string;
  let changelog_url: string;

  try {
    const body = await request.json();
    name = (body.name ?? "").trim();
    changelog_url = (body.changelog_url ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  if (!changelog_url || !/^https?:\/\//i.test(changelog_url)) {
    return Response.json({ error: "Valid changelog URL is required" }, { status: 400 });
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Check for duplicate slug
  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return Response.json({ error: "A provider with this name already exists" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("providers")
    .insert({
      name,
      slug,
      changelog_url,
      deprecation_url: changelog_url,
      status_url: null,
      is_custom: true,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ provider: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return Response.json({ error: "slug is required" }, { status: 400 });
  }

  // Only allow deleting custom providers
  const { data: provider } = await supabase
    .from("providers")
    .select("id, is_custom")
    .eq("slug", slug)
    .maybeSingle();

  if (!provider) {
    return Response.json({ error: "Provider not found" }, { status: 404 });
  }

  if (!provider.is_custom) {
    return Response.json({ error: "Cannot delete built-in providers" }, { status: 403 });
  }

  const { error } = await supabase
    .from("providers")
    .delete()
    .eq("id", provider.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

// ─── Provider ─────────────────────────────────────────────
export interface Provider {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  changelog_url: string;
  deprecation_url: string | null;
  status_url: string | null;
  is_custom: boolean;
  created_at: string;
}

// ─── Scan ─────────────────────────────────────────────────
export type ScanStatus = "running" | "completed" | "failed";

export interface Scan {
  id: string;
  status: ScanStatus;
  provider_ids: string[];
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

// ─── Snapshot ─────────────────────────────────────────────
export type SourceType = "changelog" | "deprecation" | "status";

export interface Snapshot {
  id: string;
  provider_id: string;
  scan_id: string;
  source_type: SourceType;
  raw_data: ChangelogSnapshot | DeprecationSnapshot | StatusSnapshot;
  content_hash: string;
  captured_at: string;
}

export interface ChangelogEntry {
  date: string;
  title: string;
  summary: string;
  type: string;
}

export interface ChangelogSnapshot {
  entries: ChangelogEntry[];
}

export interface DeprecationEntry {
  endpoint_name: string;
  sunset_date: string;
  migration_path: string;
}

export interface DeprecationSnapshot {
  deprecations: DeprecationEntry[];
}

export interface StatusIncident {
  title: string;
  date?: string;
  severity?: string;
  started_at?: string;
  status: string;
}

export interface StatusSnapshot {
  overall_status: "operational" | "degraded" | "outage";
  active_incidents: StatusIncident[];
  recent_incidents: StatusIncident[];
}

// ─── Change ───────────────────────────────────────────────
export type ChangeType =
  | "breaking"
  | "deprecation"
  | "feature"
  | "incident"
  | "resolved";

export type Timeline = "immediate" | "soon" | "later";

export interface Change {
  id: string;
  scan_id: string;
  provider_id: string;
  source_type: SourceType;
  title: string;
  raw_content: string;
  change_type: ChangeType;
  urgency: number;
  summary: string;
  action_required: string;
  timeline: Timeline;
  detected_at: string;
}

// ─── SSE Events ───────────────────────────────────────────
export type SSEEventType =
  | "progress"
  | "analysis_complete"
  | "scan_complete"
  | "error";

export interface SSEProgressEvent {
  type: "progress";
  provider: string;
  source: SourceType;
  status: "started" | "done" | "failed";
  message?: string;
}

export interface SSEAnalysisEvent {
  type: "analysis_complete";
  provider: string;
  changeCount: number;
}

export interface SSEScanCompleteEvent {
  type: "scan_complete";
  scanId: string;
  duration: number;
}

export interface SSEErrorEvent {
  type: "error";
  provider?: string;
  message: string;
}

export type SSEEvent =
  | SSEProgressEvent
  | SSEAnalysisEvent
  | SSEScanCompleteEvent
  | SSEErrorEvent;

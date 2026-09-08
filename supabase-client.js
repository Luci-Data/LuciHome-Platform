// ==========================================================================
// LuciHome — Supabase connection
//
// The URL and key below are the PUBLIC ones for the LuciHome project.
// They are safe to expose in frontend code — Supabase is designed for
// this, and access is actually controlled by the Row Level Security
// policies we wrote directly in the database (see the "profiles" table
// policies from Stage 2). Never put the "service_role" secret key here.
// ==========================================================================

const supabaseClient = supabase.createClient(
  'https://asxmbqyjgzrfetleukkb.supabase.co',
  'sb_publishable_BWokdp-59NkuUCC4dc-UMQ_uTiXxWno'
);

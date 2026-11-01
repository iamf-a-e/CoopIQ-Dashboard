

/* CoopIQ admin: edit this file only.
   Use the PUBLIC anon keys. Never put a service_role key in a browser file.
   Leave app.url/key blank to preview with demo data (login is skipped in demo mode). */
const CFG = {
  app: { url: "https://bpimmhuezwuiobctzygd.supabase.co/rest/v1/", key: "sb_publishable_XTucbvaYZ78hwPSCIB3iyw_oqPmzpV5" },   // Supabase project 1: the CoopIQ app (auth, farmers, diagnoses, sensors, visits, requests)
  bot: { url: "https://pbktykuvxyojltvxpetp.supabase.co/rest/v1/", key: "sb_publishable_r8d_N3hmK9fmok27xm-JNw_URd75Wpi" },   // Supabase project 2: the WhatsApp chatbot (conversations, messages)
  tables: {
    diagnoses: "diagnoses",        // created_at, farmer_name, pen, species, condition, confidence, status, channel
    sensors:   "sensor_readings",  // created_at, pen, movement, sound, temp, humidity
    visits:    "farm_visits",      // created_at, farmer_name, location, reason, status, preferred_date
    requests:  "consultations", // created_at, farmer_name, urgency, message, status
    convs:     "conversations",    // id, updated_at, name, phone, last_message, status, needs_reply
    msgs:      "messages"          // conversation_id, created_at, direction ('in'|'out'), body
  },
  // Emails allowed into the dashboard. Leave empty to allow any signed-in user (not recommended).
  // This is only a screen check: also enforce admin-only access with Row Level Security on both projects.
  adminEmails: [],
  resetRedirect: location.origin + location.pathname.replace(/[^/]*$/, "") + "reset-password.html",
  refreshSeconds: 60
};

/* Tidy the project URLs: accept ".../rest/v1", trailing slashes or spaces and reduce them to the bare project URL. */
for (const k of ["app", "bot"]) {
  CFG[k].url = CFG[k].url.trim().replace(/\/(rest|auth|storage|realtime)\/v1.*$/i, "").replace(/\/+$/, "");
  CFG[k].key = CFG[k].key.trim();
}

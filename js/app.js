/* Shared shell, auth guard, data and page renderers for every dashboard page. */
const mk = c => (c.url && c.key && window.supabase) ? supabase.createClient(c.url, c.key) : null;
const appDB = mk(CFG.app), botDB = mk(CFG.bot);
const PAGE = document.body.dataset.page;
const S = { demo: !appDB && !botDB, data: {}, errors: [], user: null, chat: null, msgs: [], q: "", f: "" };
const NAV = [["index","Dashboard"],["chats","Chats"],["diagnoses","Diagnoses"],["sensors","Coop sensors"],["requests","Agrovet requests"],["profile","Profile"],["settings","Settings"]];

const ago = m => new Date(Date.now() - m * 60000).toISOString();
const DEMO = {
  diagnoses: [
    {condition:"Coccidiosis",farmer_name:"Tendai M.",pen:"Pen 3",species:"Broilers",confidence:"High",status:"escalated",channel:"WhatsApp",created_at:ago(20)},
    {condition:"Newcastle disease",farmer_name:"Grace N.",pen:"Pen 1",species:"Layers",confidence:"Medium",status:"pending",channel:"App",created_at:ago(95)},
    {condition:"Healthy",farmer_name:"Joseph K.",pen:"Pen 2",species:"Broilers",confidence:"High",status:"treated",channel:"WhatsApp",created_at:ago(180)},
    {condition:"Coccidiosis",farmer_name:"Amina S.",pen:"Pen 5",species:"Kienyeji",confidence:"High",status:"treated",channel:"WhatsApp",created_at:ago(320)},
    {condition:"Fowl typhoid",farmer_name:"Peter O.",pen:"Pen 4",species:"Layers",confidence:"Low",status:"pending",channel:"App",created_at:ago(1500)},
    {condition:"Gumboro",farmer_name:"Ruth C.",pen:"Pen 1",species:"Broilers",confidence:"Medium",status:"treated",channel:"WhatsApp",created_at:ago(2900)}],
  sensors: [
    {pen:"Pen 1",movement:"Active",sound:"Normal",temp:29.1,humidity:60,created_at:ago(2)},
    {pen:"Pen 2",movement:"Active",sound:"Normal",temp:29.6,humidity:62,created_at:ago(2)},
    {pen:"Pen 3",movement:"Low",sound:"Altered",temp:30.2,humidity:66,created_at:ago(3)},
    {pen:"Pen 4",movement:"Active",sound:"Normal",temp:28.8,humidity:58,created_at:ago(2)}],
  visits: [
    {farmer_name:"Grace N.",location:"Nakuru",reason:"Immunization",status:"pending",preferred_date:"2026-10-16",created_at:ago(300)},
    {farmer_name:"Tendai M.",location:"Harare",reason:"Treatment",status:"confirmed",preferred_date:"2026-10-14",created_at:ago(40)}],
  requests: [
    {farmer_name:"Tendai M.",urgency:"Urgent",message:"Birds in pen 3 have bloody droppings, 6 down since morning",status:"open",created_at:ago(18)},
    {farmer_name:"Peter O.",urgency:"Standard",message:"Second opinion on fowl typhoid result",status:"open",created_at:ago(700)}],
  convs: [
    {id:1,name:"Tendai M.",phone:"+263 77 000 0001",last_message:"Photo sent: droppings_pen3.jpg",status:"open",needs_reply:true,updated_at:ago(6)},
    {id:2,name:"Grace N.",phone:"+254 70 000 0002",last_message:"How much amprolium for 200 birds?",status:"open",needs_reply:true,updated_at:ago(25)},
    {id:3,name:"Joseph K.",phone:"+263 71 000 0003",last_message:"Thanks, they look better today",status:"resolved",needs_reply:false,updated_at:ago(240)}],
  msgs: [
    {conversation_id:1,direction:"in",body:"Birds in pen 3 have watery droppings with blood",created_at:ago(9)},
    {conversation_id:1,direction:"out",body:"Likely coccidiosis. Please send a clear photo of the droppings.",created_at:ago(8)},
    {conversation_id:1,direction:"in",body:"Photo sent: droppings_pen3.jpg",created_at:ago(6)}]
};

/* ---------- helpers ---------- */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const since = iso => { const m = Math.max(0, (Date.now() - new Date(iso)) / 60000); return m < 1 ? "just now" : m < 60 ? `${Math.round(m)} min ago` : m < 1440 ? `${Math.round(m/60)} h ago` : `${Math.round(m/1440)} d ago`; };
const isToday = iso => new Date(iso).toDateString() === new Date().toDateString();
const tone = s => ({escalated:"bad",open:"warn",pending:"warn",urgent:"bad",confirmed:"info",treated:"",resolved:"",closed:""}[String(s).toLowerCase()] ?? "info");
const pill = (t, c) => `<span class="pill ${c ?? tone(t)}">${esc(t)}</span>`;
const urgent = r => /urgent/i.test(r.urgency || "");
const flagged = s => /alter|distress/i.test(s.sound || "") || /low|still/i.test(s.movement || "");
const latestPens = () => { const seen = {}; (S.data.sensors || []).forEach(s => { if (!seen[s.pen]) seen[s.pen] = s; }); return Object.values(seen).sort((a, b) => String(a.pen).localeCompare(String(b.pen))); };
const none = t => `<div class="empty">${t}</div>`;
const $ = id => document.getElementById(id);

/* ---------- auth guard ---------- */
async function guard() {
  if (!appDB) return true;                                   // demo mode
  const { data } = await appDB.auth.getSession();
  if (!data.session) { location.href = "login.html"; return false; }
  S.user = data.session.user;
  const allow = CFG.adminEmails.map(e => e.toLowerCase());
  if (allow.length && !allow.includes((S.user.email || "").toLowerCase())) {
    await appDB.auth.signOut();
    location.href = "login.html?denied=1"; return false;
  }
  return true;
}

/* ---------- data ---------- */
async function pull(db, key, order) {
  if (S.demo) return DEMO[key] || [];
  if (!db) return [];
  const { data, error } = await db.from(CFG.tables[key]).select("*").order(order, { ascending: false }).limit(300);
  if (error) { S.errors.push(`${CFG.tables[key]}: ${error.message}`); return []; }
  return data || [];
}
async function load() {
  S.errors = [];
  const [diagnoses, sensors, visits, requests, convs] = await Promise.all([
    pull(appDB,"diagnoses","created_at"), pull(appDB,"sensors","created_at"), pull(appDB,"visits","created_at"),
    pull(appDB,"requests","created_at"), pull(botDB,"convs","updated_at")]);
  S.data = { diagnoses, sensors, visits, requests, convs };
  render();
}
async function openChat(id) {
  S.chat = id;
  if (S.demo) S.msgs = DEMO.msgs.filter(m => m.conversation_id == id);
  else if (botDB) { const { data } = await botDB.from(CFG.tables.msgs).select("*").eq("conversation_id", id).order("created_at"); S.msgs = data || []; }
  render();
}

/* ---------- shared pieces ---------- */
function pens() {
  return `<div class="pens">${latestPens().map(s => `<div class="pen ${flagged(s) ? "flag" : ""}"><h3>${esc(s.pen)} ${flagged(s) ? pill("Watch","warn") : ""}</h3>
    <dl><dt>Movement</dt><dd>${esc(s.movement)}</dd><dt>Sound</dt><dd>${esc(s.sound)}</dd><dt>Temp</dt><dd>${esc(s.temp)}°C</dd><dt>Humidity</dt><dd>${esc(s.humidity)}%</dd><dt>Updated</dt><dd>${since(s.created_at)}</dd></dl></div>`).join("") || none("No sensor readings yet. Readings appear once the coop sensors report in.")}</div>`;
}
function table(title, sub, rows, cols, tools = "") {
  return `<section class="card"><h3>${title}</h3><p>${sub}</p>${tools}<div class="tw"><table><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>
  ${rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">${none("Nothing matches yet.")}</td></tr>`}</tbody></table></div></section>`;
}
const filt = (rows, fields, statusKey = "status") => rows.filter(r =>
  (!S.f || String(r[statusKey]).toLowerCase() === S.f) && (!S.q || fields.some(k => String(r[k] ?? "").toLowerCase().includes(S.q))));
const tools = statuses => `<div class="tools"><input id="q" type="search" placeholder="Search" value="${esc(S.q)}" aria-label="Search"><select id="f" aria-label="Status"><option value="">All statuses</option>${statuses.map(s => `<option ${S.f === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>`;

/* ---------- pages ---------- */
const PAGES = {
  index: ["Dashboard", "Overview of chats, diagnoses, requests and coop health.", () => {
    const d = S.data, openChats = d.convs.filter(c => c.status !== "resolved"), needs = d.convs.filter(c => c.needs_reply);
    const urgentReq = d.requests.filter(r => urgent(r) && r.status !== "closed"), alerts = latestPens().filter(flagged);
    const counts = {}; d.diagnoses.filter(x => !/healthy/i.test(x.condition)).forEach(x => counts[x.condition] = (counts[x.condition] || 0) + 1);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5), max = top[0]?.[1] || 1;
    const ok = !alerts.length && !urgentReq.length;
    return `
    <div class="banner"><div><h2>Welcome back${S.user ? ", " + esc(S.user.user_metadata?.full_name || S.user.email) : ""}</h2><p>Review diagnoses, farm requests, coop sensors and live chats from one place.</p></div>${pill(ok ? "System health: Good" : "System health: Needs attention")}</div>
    <div class="kpis">
      <div class="card kpi"><small>Open conversations</small><b>${openChats.length}</b><span>${needs.length} waiting on a reply</span></div>
      <div class="card kpi"><small>Diagnoses today</small><b>${d.diagnoses.filter(x => isToday(x.created_at)).length}</b><span>${d.diagnoses.length} in recent history</span></div>
      <div class="card kpi ${urgentReq.length ? "alert" : ""}"><small>Urgent agrovet requests</small><b>${urgentReq.length}</b><span>${d.requests.length} total requests</span></div>
      <div class="card kpi"><small>Farm visits pending</small><b>${d.visits.filter(v => v.status === "pending").length}</b><span>${d.visits.length} booked in total</span></div>
      <div class="card kpi ${alerts.length ? "alert" : ""}"><small>Pens flagged by sensors</small><b>${alerts.length}</b><span>${latestPens().length} pens reporting</span></div>
      <div class="card kpi"><small>Resolved today</small><b>${d.convs.filter(c => c.status === "resolved" && isToday(c.updated_at)).length}</b><span>Chats closed</span></div>
    </div>
    <div class="grid">
      <section class="card c7"><h3>Latest diagnoses</h3><p>Photo results from WhatsApp and the app.</p>
        ${d.diagnoses.slice(0, 6).map(x => `<div class="row"><div class="m"><b>${esc(x.condition)} · ${esc(x.pen)}</b><span>${esc(x.farmer_name)} · ${esc(x.species)} · ${esc(x.channel)} · ${since(x.created_at)}</span></div>${pill(x.status)}</div>`).join("") || none("No diagnoses yet. They appear when farmers send photos.")}</section>
      <section class="card c5"><h3>Top conditions</h3><p>Most common flagged diagnoses.</p>
        ${top.map(([k, v]) => `<div class="bar"><div><span>${esc(k)}</span><b>${v}</b></div><i><s style="width:${v / max * 100}%"></s></i></div>`).join("") || none("No flagged conditions.")}</section>
      <section class="card c12"><h3>Coop sensors</h3><p>Latest reading per pen. Highlighted pens show low movement or altered sound.</p>${pens()}</section>
      <section class="card c6"><h3>Needs reply</h3><p>Open chats waiting on an agent.</p>
        ${needs.slice(0, 5).map(c => `<div class="row"><div class="m"><b>${esc(c.name || c.phone)}</b><span>${esc(c.last_message)}</span></div><a class="btn" href="chats.html?id=${encodeURIComponent(c.id)}">Open</a></div>`).join("") || none("You're all caught up.")}</section>
      <section class="card c6"><h3>Agrovet requests</h3><p>Consultations and farm visit bookings.</p>
        ${d.requests.slice(0, 3).map(r => `<div class="row"><div class="m"><b>${esc(r.farmer_name)}</b><span>${esc(r.message)}</span></div>${pill(r.urgency || r.status, urgent(r) ? "bad" : "info")}</div>`).join("")}
        ${d.visits.slice(0, 3).map(v => `<div class="row"><div class="m"><b>${esc(v.farmer_name)} · ${esc(v.reason)}</b><span>${esc(v.location)} · ${esc(v.preferred_date || "date to confirm")}</span></div>${pill(v.status)}</div>`).join("")}
        ${!d.requests.length && !d.visits.length ? none("No requests yet.") : ""}</section>
    </div>`;
  }],
  chats: ["Chats", "WhatsApp conversations from the chatbot database.", () => {
    const cs = S.data.convs, cur = cs.find(c => c.id == S.chat);
    return `<div class="chat"><section class="card list">${cs.map(c => `<button data-chat="${esc(c.id)}" aria-current="${c.id == S.chat}"><b>${esc(c.name || c.phone)}</b> ${c.needs_reply ? pill("Needs reply","warn") : ""}<span>${esc(c.last_message)}</span></button>`).join("") || none("No conversations yet.")}</section>
    <section class="card thread">${cur ? `<h3>${esc(cur.name || cur.phone)}</h3><p>${esc(cur.phone)} · ${since(cur.updated_at)}</p>` + (S.msgs.map(m => `<div class="msg ${m.direction === "out" ? "out" : ""}">${esc(m.body)}<small>${since(m.created_at)}</small></div>`).join("") || none("No messages loaded.")) : none("Choose a conversation to read it.")}</section></div>`;
  }],
  diagnoses: ["Diagnoses", "Every photo diagnosis from the app and WhatsApp.", () => table("Diagnosis records", "Newest first.",
    filt(S.data.diagnoses, ["condition","farmer_name","pen","species"]),
    [["When",r=>since(r.created_at)],["Farmer",r=>esc(r.farmer_name)],["Pen",r=>esc(r.pen)],["Species",r=>esc(r.species)],["Condition",r=>`<b>${esc(r.condition)}</b>`],["Confidence",r=>esc(r.confidence)],["Channel",r=>esc(r.channel)],["Status",r=>pill(r.status)]],
    tools(["pending","treated","escalated"]))],
  sensors: ["Coop sensors", "Movement, sound, temperature and humidity per pen.", () => `<section class="card">${pens()}</section>`],
  requests: ["Agrovet requests", "Consultations and farm visit bookings.", () =>
    table("Consultations", "Newest first.", filt(S.data.requests, ["farmer_name","message"]), [["When",r=>since(r.created_at)],["Farmer",r=>esc(r.farmer_name)],["Urgency",r=>pill(r.urgency || "Standard", urgent(r) ? "bad" : "info")],["Message",r=>esc(r.message)],["Status",r=>pill(r.status)]], tools(["open","closed"])) +
    `<div style="height:14px"></div>` + table("Farm visits", "Booked and pending visits.", S.data.visits, [["Farmer",r=>esc(r.farmer_name)],["Location",r=>esc(r.location)],["Reason",r=>esc(r.reason)],["Preferred date",r=>esc(r.preferred_date || "To confirm")],["Status",r=>pill(r.status)]])],
  profile: ["Profile", "Your account details.", () => {
    const u = S.user, m = u?.user_metadata || {};
    return `<section class="card"><h3>${esc(m.full_name || "Demo admin")}</h3><p>${esc(u?.email || "Demo mode: sign in is skipped")}</p>
    <div class="row"><div class="m"><b>Phone</b><span>${esc(m.phone || "Not set")}</span></div></div>
    <div class="row"><div class="m"><b>Password</b><span>We'll email you a reset link.</span></div><button class="btn" id="resetpw" ${u ? "" : "disabled"}>Send reset link</button></div>
    <div class="row"><div class="m"><b>Session</b><span>Sign out on this device.</span></div><button class="btn o" id="signout">Sign out</button></div><div id="pmsg" class="msgbox"></div></section>`;
  }],
  settings: ["Settings", "Database connections and workspace status.", () => {
    const row = (n, db) => `<div class="row"><div class="m"><b>${n}</b></div>${pill(db ? "Connected" : "Not configured", db ? "" : "warn")}</div>`;
    return `<section class="card"><h3>Connections</h3><p>Set URLs and anon keys in js/config.js.</p>
      ${row("App database: auth, diagnoses, sensors, visits, requests", appDB)}${row("Chatbot database: conversations, messages", botDB)}
      ${row("Admin allowlist: " + (CFG.adminEmails.length ? CFG.adminEmails.length + " email(s)" : "off, any signed-in user can enter"), CFG.adminEmails.length)}
      ${S.errors.map(e => `<div class="row"><div class="m"><b>Query error</b><span>${esc(e)}</span></div>${pill("Check RLS or table name","bad")}</div>`).join("")}</section>`;
  }]
};

/* ---------- shell ---------- */
function shell() {
  document.body.insertAdjacentHTML("afterbegin", `
  <button class="menu" id="menu" aria-label="Open menu">Menu</button>
  <aside><a class="brand" href="index.html" style="text-decoration:none"><img src="img/logo.png" alt="CoopIQ logo">CoopIQ</a>
    <div class="live"><b id="liveN">0</b>Live conversations right now</div>
    <nav aria-label="Main">${NAV.map(([k, t]) => `<a href="${k}.html" ${k === PAGE ? 'aria-current="page"' : ""}>${t}<span class="n" id="n-${k}" hidden></span></a>`).join("")}</nav>
    <div class="me"><div><b>${esc(S.user?.user_metadata?.full_name || S.user?.email || "Demo admin")}</b>${S.user ? esc(S.user.email) : "Preview with sample data"}</div><button class="btn" id="out2">Sign out</button></div>
  </aside><main id="main" aria-live="polite"></main>`);
}
function render() {
  const [t, sub, fn] = PAGES[PAGE], d = S.data;
  const badge = (k, n) => { const el = $("n-" + k); if (el) { el.hidden = !n; el.textContent = n; } };
  badge("chats", d.convs.filter(c => c.needs_reply).length); badge("requests", d.requests.filter(r => r.status === "open").length);
  $("liveN").textContent = d.convs.filter(c => c.status !== "resolved").length;
  const keep = document.activeElement?.id;
  $("main").innerHTML = `<div class="top"><div><h1>${t}</h1><p>${sub}</p></div><button class="btn p" id="refresh">Refresh</button></div>
    ${S.demo ? `<div class="note"><b>Demo data.</b> Add your two Supabase project URLs and anon keys in js/config.js to see live data.</div>` : ""}
    ${S.errors.length && PAGE !== "settings" ? `<div class="note">Some queries failed. Open Settings for details.</div>` : ""}${fn()}`;
  if (keep === "q") { const q = $("q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
async function signOut() { if (appDB) await appDB.auth.signOut(); location.href = appDB ? "login.html" : "index.html"; }

document.addEventListener("click", async e => {
  const c = e.target.closest("[data-chat]");
  if (c) openChat(c.dataset.chat);
  else if (e.target.id === "refresh") load();
  else if (e.target.id === "menu") document.body.classList.toggle("open");
  else if (e.target.id === "out2" || e.target.id === "signout") signOut();
  else if (e.target.id === "resetpw") {
    const { error } = await appDB.auth.resetPasswordForEmail(S.user.email, { redirectTo: CFG.resetRedirect });
    $("pmsg").textContent = error ? error.message : "Reset link sent to " + S.user.email + ".";
  }
});
document.addEventListener("input", e => { if (e.target.id === "q") { S.q = e.target.value.toLowerCase(); render(); } });
document.addEventListener("change", e => { if (e.target.id === "f") { S.f = e.target.value; render(); } });

(async () => {
  if (!(await guard())) return;
  shell(); await load(); setInterval(load, CFG.refreshSeconds * 1000);
  const id = new URLSearchParams(location.search).get("id"); if (id && PAGE === "chats") openChat(id);
})();

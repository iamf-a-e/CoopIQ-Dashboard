/* login.html and reset-password.html */
const $ = id => document.getElementById(id);
const db = (CFG.app.url && CFG.app.key && window.supabase) ? supabase.createClient(CFG.app.url, CFG.app.key) : null;
const page = document.body.dataset.page;
let signUp = false, pending = null;
const say = (t, err) => { const m = $("msg"); m.textContent = t || ""; m.className = "msgbox" + (err ? " err" : ""); };
const busy = b => document.querySelectorAll("button").forEach(x => x.disabled = b);

if (!db) say("Add your app Supabase URL and anon key in js/config.js to enable sign in. Opening the dashboard in demo mode instead is possible from index.html.", true);
else db.auth.getSession().then(({ data }) => { if (data.session && page === "login") location.href = "index.html"; });

function setMode() {
  $("title").textContent = signUp ? "Create your account" : "Welcome back";
  $("extra").hidden = !signUp; $("forgot").hidden = signUp;
  $("go").textContent = signUp ? "Create account" : "Sign in";
  $("toggle").textContent = signUp ? "I already have an account" : "New here? Create an account";
  $("pass").autocomplete = signUp ? "new-password" : "current-password"; say("");
}

if (page === "login") {
  $("toggle").onclick = () => { signUp = !signUp; setMode(); };
  $("form").onsubmit = async e => {
    e.preventDefault(); if (!db) return;
    const email = $("email").value.trim(), pw = $("pass").value;
    if (pw.length < 6) return say("Password must be at least 6 characters.", true);
    busy(true); say("");
    try {
      if (signUp) {
        const name = $("name").value.trim(); if (!name) throw { message: "Enter your full name." };
        const { data, error } = await db.auth.signUp({ email, password: pw, options: { data: { full_name: name, phone: $("phone").value.trim() }, emailRedirectTo: location.href } });
        if (error) throw error;
        if (data.session) location.href = "index.html";
        else { signUp = false; setMode(); pending = email; $("resend").hidden = false; say("Account created. Check " + email + " for a confirmation link, then sign in."); }
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password: pw });
        if (error) { if (/not confirmed/i.test(error.message)) { pending = email; $("resend").hidden = false; } throw error; }
        location.href = "index.html";
      }
    } catch (err) { say(err.message || "Something went wrong. Try again.", true); }
    busy(false);
  };
  $("forgot").onclick = async () => {
    const email = $("email").value.trim();
    if (!email.includes("@")) return say("Enter your email first, then tap Forgot password.", true);
    busy(true);
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: CFG.resetRedirect });
    // Same message whether or not the account exists, so nobody can probe for accounts.
    say(error ? error.message : "If an account exists for " + email + ", a reset link is on its way.", !!error); busy(false);
  };
  $("resend").onclick = async () => {
    busy(true); const { error } = await db.auth.resend({ type: "signup", email: pending });
    say(error ? error.message : "Confirmation email sent to " + pending + ".", !!error); busy(false);
  };
  setMode();
} else {
  /* reset-password: Supabase puts a recovery session in the URL; the client picks it up. */
  $("form").onsubmit = async e => {
    e.preventDefault(); const pw = $("pass").value;
    if (pw.length < 6) return say("Password must be at least 6 characters.", true);
    if (pw !== $("pass2").value) return say("The two passwords don't match.", true);
    busy(true);
    const { error } = await db.auth.updateUser({ password: pw });
    if (error) say(error.message, true); else { say("Password updated. Taking you to the dashboard…"); setTimeout(() => location.href = "index.html", 1200); }
    busy(false);
  };
}

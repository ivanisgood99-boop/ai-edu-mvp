(function () {
  "use strict";
  function client() {
    if (window.sbClient) return window.sbClient;
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      window.sbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return window.sbClient;
    }
    return null;
  }
  async function getCurrentSession() {
    var sb = client();
    if (!sb) return { session: null, user: null };
    var r = await sb.auth.getSession();
    var s = r && r.data ? r.data.session : null;
    return { session: s, user: s && s.user ? s.user : null };
  }
  async function signUpStudent(email, password, displayName) {
    var sb = client();
    if (!sb) return { ok: false, message: "尚未建立 Supabase 用戶端" };
    var r = await sb.auth.signUp({
      email: email,
      password: password,
      options: { data: { display_name: displayName, role: "student" } }
    });
    if (r.error) return { ok: false, message: r.error.message };
    return { ok: true, message: r.data && r.data.session ? "註冊並登入成功" : "註冊成功，請依信箱設定完成驗證" };
  }
  async function signInStudent(email, password) {
    var sb = client();
    if (!sb) return { ok: false, message: "尚未建立 Supabase 用戶端" };
    var r = await sb.auth.signInWithPassword({ email: email, password: password });
    if (r.error) return { ok: false, message: r.error.message };
    return { ok: true, message: "登入成功" };
  }
  async function signOutStudent() {
    var sb = client();
    if (sb) await sb.auth.signOut();
    return { ok: true };
  }
  async function sendPasswordReset(email, redirectTo) {
    var sb = client();
    if (!sb) return { ok: false, message: "尚未建立 Supabase 用戶端" };
    var r = await sb.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo: redirectTo } : undefined);
    if (r.error) return { ok: false, message: r.error.message };
    return { ok: true, message: "已寄出密碼重設信" };
  }
  async function loadStudentProfileAndResources(user) {
    var sb = client();
    var p = { id: user.id, display_name: (user.user_metadata && user.user_metadata.display_name) || user.email, role: "student" };
    if (!sb) return { profile: p, resources: null };
    var pr = await sb.from("profiles").select("id,display_name,role,account_status").eq("id", user.id).maybeSingle();
    var rr = await sb.from("student_resources").select("*").eq("student_id", user.id).maybeSingle();
    return { profile: (pr && pr.data) || p, resources: (rr && rr.data) || null };
  }
  function subscribeAuthState(cb) {
    var sb = client();
    if (!sb || !sb.auth || !sb.auth.onAuthStateChange) return function () {};
    var sub = sb.auth.onAuthStateChange(function (ev, sess) { cb(ev, sess); });
    return function () { if (sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe(); };
  }
  window.AuthSystemModule = {
    getCurrentSession: getCurrentSession,
    signUpStudent: signUpStudent,
    signInStudent: signInStudent,
    signOutStudent: signOutStudent,
    sendPasswordReset: sendPasswordReset,
    loadStudentProfileAndResources: loadStudentProfileAndResources,
    subscribeAuthState: subscribeAuthState
  };
})();

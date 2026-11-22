/* 正式學生帳號與 Supabase Auth 模組（原生 JS，無框架、無寫死密鑰） */
(function () {
  "use strict";

  var AUTH_SESSION_CACHE_KEY = "ai_edu_auth_user_meta_v1";

  function getSupabaseClient() {
    if (window.supabaseClient && window.supabaseClient.auth) {
      return window.supabaseClient;
    }
    var url = (window.SUPABASE_URL || "").trim();
    var anonKey = (window.SUPABASE_ANON_KEY || "").trim();
    if (window.supabase && typeof window.supabase.createClient === "function" && url && anonKey) {
      window.supabaseClient = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return window.supabaseClient;
    }
    return null;
  }

  async function getCurrentSession() {
    var sb = getSupabaseClient();
    if (!sb) {
      return { session: null, user: null, configured: false, error: "尚未設定 Supabase URL 與 Anon Key" };
    }
    var res = await sb.auth.getSession();
    var session = res && res.data ? res.data.session : null;
    var user = session && session.user ? session.user : null;
    return { session: session, user: user, configured: true, error: res && res.error ? res.error.message : null };
  }

  async function signUpStudent(email, password, displayName) {
    var sb = getSupabaseClient();
    if (!sb) return { ok: false, message: "尚未設定 Supabase 連線資訊。" };
    var cleanEmail = String(email || "").trim();
    var cleanPwd = String(password || "");
    var cleanName = String(displayName || "").trim();
    if (!cleanEmail || !cleanPwd || !cleanName) {
      return { ok: false, message: "請完整填寫顯示名稱、電子郵件與密碼。" };
    }
    if (cleanPwd.length < 6) {
      return { ok: false, message: "密碼長度至少需 6 個字元。" };
    }
    var res = await sb.auth.signUp({
      email: cleanEmail,
      password: cleanPwd,
      options: {
        data: {
          display_name: cleanName,
          role: "student"
        }
      }
    });
    if (res.error) {
      return { ok: false, message: "註冊失敗：" + res.error.message };
    }
    return {
      ok: true,
      user: res.data && res.data.user ? res.data.user : null,
      message: res.data && res.data.session
        ? "註冊成功並已登入。"
        : "註冊已送出；若系統啟用信箱驗證，請先至信箱完成驗證後再登入。"
    };
  }

  async function signInStudent(email, password) {
    var sb = getSupabaseClient();
    if (!sb) return { ok: false, message: "尚未設定 Supabase 連線資訊。" };
    var cleanEmail = String(email || "").trim();
    var cleanPwd = String(password || "");
    if (!cleanEmail || !cleanPwd) {
      return { ok: false, message: "請輸入電子郵件與密碼。" };
    }
    var res = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPwd
    });
    if (res.error) {
      return { ok: false, message: "登入失敗：" + res.error.message };
    }
    return { ok: true, user: res.data && res.data.user ? res.data.user : null, message: "登入成功。" };
  }

  async function signOutStudent() {
    var sb = getSupabaseClient();
    try { localStorage.removeItem(AUTH_SESSION_CACHE_KEY); } catch (e) {}
    if (!sb) return { ok: true, message: "已登出本機狀態。" };
    var res = await sb.auth.signOut();
    if (res.error) {
      return { ok: false, message: "登出發生錯誤：" + res.error.message };
    }
    return { ok: true, message: "已安全登出。" };
  }

  async function sendPasswordReset(email, redirectTo) {
    var sb = getSupabaseClient();
    if (!sb) return { ok: false, message: "尚未設定 Supabase 連線資訊。" };
    var cleanEmail = String(email || "").trim();
    if (!cleanEmail) return { ok: false, message: "請輸入註冊時使用的電子郵件。" };
    var opts = redirectTo ? { redirectTo: redirectTo } : undefined;
    var res = await sb.auth.resetPasswordForEmail(cleanEmail, opts);
    if (res.error) {
      return { ok: false, message: "寄送重設信失敗：" + res.error.message };
    }
    return { ok: true, message: "若該信箱已註冊，密碼重設連結已寄出，請查收信件。" };
  }

  async function updateNewPassword(newPassword) {
    var sb = getSupabaseClient();
    if (!sb) return { ok: false, message: "尚未設定 Supabase 連線資訊。" };
    var pwd = String(newPassword || "");
    if (pwd.length < 6) return { ok: false, message: "新密碼至少需 6 個字元。" };
    var res = await sb.auth.updateUser({ password: pwd });
    if (res.error) {
      return { ok: false, message: "更新密碼失敗：" + res.error.message };
    }
    return { ok: true, message: "密碼已成功更新，請重新登入。" };
  }

  async function loadStudentProfileAndResources(user) {
    if (!user || !user.id) return { profile: null, resources: null };
    var sb = getSupabaseClient();
    var fallbackProfile = {
      id: user.id,
      display_name: (user.user_metadata && user.user_metadata.display_name) || user.email || "學員",
      role: "student",
      account_status: "active"
    };
    if (!sb) return { profile: fallbackProfile, resources: null };

    var pRes = await sb
      .from("profiles")
      .select("id, display_name, role, account_status, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    var profile = (pRes && pRes.data) ? pRes.data : fallbackProfile;

    var rRes = await sb
      .from("student_resources")
      .select("student_id, learning_points, stamina, stamina_max, stamina_bonus_total, rocket_supplies, stardust, gems, updated_at")
      .eq("student_id", user.id)
      .maybeSingle();

    return {
      profile: profile,
      resources: (rRes && rRes.data) ? rRes.data : null
    };
  }

  function subscribeAuthState(onChange) {
    var sb = getSupabaseClient();
    if (!sb || !sb.auth || typeof sb.auth.onAuthStateChange !== "function") {
      return function () {};
    }
    var sub = sb.auth.onAuthStateChange(function (event, session) {
      if (typeof onChange === "function") {
        onChange(event, session);
      }
    });
    return function () {
      if (sub && sub.data && sub.data.subscription && typeof sub.data.subscription.unsubscribe === "function") {
        sub.data.subscription.unsubscribe();
      }
    };
  }

  window.AuthSystemModule = {
    getSupabaseClient: getSupabaseClient,
    getCurrentSession: getCurrentSession,
    signUpStudent: signUpStudent,
    signInStudent: signInStudent,
    signOutStudent: signOutStudent,
    sendPasswordReset: sendPasswordReset,
    updateNewPassword: updateNewPassword,
    loadStudentProfileAndResources: loadStudentProfileAndResources,
    subscribeAuthState: subscribeAuthState
  };
})();

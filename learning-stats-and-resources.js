(function () {
  "use strict";
  function sb() {
    if (window.sbClient) return window.sbClient;
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      window.sbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      return window.sbClient;
    }
    return null;
  }
  async function syncResourcesAndRockets() {
    var c = sb();
    if (!c) return null;
    var r = await c.rpc("sync_student_stamina_and_rockets", { p_tz: "Asia/Taipei" });
    return r && !r.error ? r.data : null;
  }
  async function consumeRocketSupply() {
    var c = sb();
    if (!c) return { ok: false, message: "尚未連線" };
    var r = await c.rpc("use_rocket_supply");
    if (r.error) return { ok: false, message: r.error.message };
    return { ok: true, resources: r.data };
  }
  async function fetchStudentStatistics(uid) {
    var c = sb();
    if (!c || !uid) return [];
    var r = await c.from("learning_statistics").select("*").eq("student_id", uid);
    return (r && r.data) || [];
  }
  window.LearningStatsAndResourcesModule = {
    syncResourcesAndRockets: syncResourcesAndRockets,
    consumeRocketSupply: consumeRocketSupply,
    fetchStudentStatistics: fetchStudentStatistics
  };
})();

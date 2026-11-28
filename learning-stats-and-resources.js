(function () {
  "use strict";

  function sb() {
    if (window.sbClient) return window.sbClient;
    if (window.AuthSystemModule && typeof window.AuthSystemModule.getSupabaseClient === "function") {
      return window.AuthSystemModule.getSupabaseClient();
    }
    if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      window.sbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return window.sbClient;
    }
    return null;
  }

  function starToLabel(rating) {
    if (rating === "THREE_STARS") return "★★★ 精熟";
    if (rating === "TWO_STARS") return "★★☆ 穩定進步";
    if (rating === "ONE_STAR") return "★☆☆ 需要加強";
    return "尚未評定";
  }

  async function fetchStudentStatistics(studentId) {
    var c = sb();
    if (!c || !studentId) return [];
    var r = await c
      .from("learning_statistics")
      .select("*")
      .eq("student_id", studentId)
      .order("level_id", { ascending: true });
    if (r && r.error) {
      throw new Error("讀取學習統計失敗：" + r.error.message);
    }
    return (r && Array.isArray(r.data)) ? r.data : [];
  }

  async function commitLearningSummary(opts) {
    var c = sb();
    if (!c) {
      return { ok: false, message: "尚未建立 Supabase 連線，無法儲存學習紀錄。" };
    }
    var levelId = opts && opts.levelId ? String(opts.levelId) : "";
    if (!levelId) {
      return { ok: false, message: "缺少 level_id，無法更新精熟程度。" };
    }

    // Ensure all earlier answers for this Level have reached the server before recomputing progress.
    if (window.TeachingEngineModule && typeof window.TeachingEngineModule.flushLearningSync === "function") {
      var pendingSync = await window.TeachingEngineModule.flushLearningSync(levelId);
      if (!pendingSync.ok) {
        return {
          ok: false,
          message: "仍有作答紀錄尚未成功同步，暫時不更新正式精熟度。請確認網路後重新嘗試。原因：" + pendingSync.message
        };
      }
    }

    var rpcRes = await c.rpc("save_summary_and_recompute_level", {
      p_level_id: levelId,
      p_chapter_id: (opts && opts.chapterId) || null,
      p_stage_id: (opts && opts.stageId) || "X-2",
      p_mark_stage_completed: opts && typeof opts.markStageCompleted === "boolean" ? opts.markStageCompleted : true
    });

    if (rpcRes && rpcRes.error) {
      return { ok: false, message: "儲存失敗：" + rpcRes.error.message };
    }

    // RPC transport 成功不代表 Level 已通過伺服器端完成條件；必須檢查重算結果。
    var updatedRow = rpcRes ? rpcRes.data : null;
    if (!updatedRow || updatedRow.level_completed !== true) {
      return {
        ok: false,
        message: "伺服器尚未確認本 Level 完成。請確認所有必要作答已成功同步，再重新提交學習總結。",
        updatedRow: updatedRow
      };
    }

    // 只有伺服器確認 level_completed=true 後，才回報正式完成。
    var uid = opts && opts.studentId ? opts.studentId : null;
    var statsWarning = null;
    var freshStats = [];
    try {
      if (!uid && window.AuthSystemModule && typeof window.AuthSystemModule.getCurrentSession === "function") {
        var s = await window.AuthSystemModule.getCurrentSession();
        uid = s && s.user ? s.user.id : null;
      }
      if (uid) freshStats = await fetchStudentStatistics(uid);
      else statsWarning = "紀錄已寫入，但目前無法取得登入者資料以重新讀取星級。";
    } catch (refreshError) {
      statsWarning = "紀錄已寫入；但重新讀取星級失敗：" +
        (refreshError && refreshError.message ? refreshError.message : "請重新整理頁面。");
    }

    return {
      ok: true,
      message: "已成功更新學習紀錄與精熟程度。",
      updatedRow: updatedRow,
      stats: freshStats,
      statsWarning: statsWarning
    };
  }

  async function syncResourcesAndRockets() {
    var c = sb();
    if (!c) return null;
    var r = await c.rpc("sync_student_stamina_and_rockets", { p_tz: "Asia/Taipei" });
    return (r && !r.error) ? r.data : null;
  }

  async function consumeRocketSupply() {
    var c = sb();
    if (!c) return { ok: false, message: "尚未連線 Supabase" };
    var r = await c.rpc("use_rocket_supply");
    if (r && r.error) return { ok: false, message: r.error.message };
    return { ok: true, resources: r ? r.data : null };
  }

  window.LearningStatsAndResourcesModule = {
    starToLabel: starToLabel,
    fetchStudentStatistics: fetchStudentStatistics,
    commitLearningSummary: commitLearningSummary,
    syncResourcesAndRockets: syncResourcesAndRockets,
    consumeRocketSupply: consumeRocketSupply
  };
})();

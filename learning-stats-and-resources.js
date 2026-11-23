/* 學習統計重算、星星證據評級與能量/火箭補給/學習點數同步模組（原生 JS） */
(function () {
  "use strict";

  var CHAPTERS = [
    { id: "CH-1", title: "Chapter 1：數與式", levels: ["CH1-L1", "CH1-L2"] },
    { id: "CH-2", title: "Chapter 2：直線與圓", levels: ["CH2-L1", "CH2-L2"] },
    { id: "CH-3", title: "Chapter 3：多項式", levels: ["CH3-L1", "CH3-L2"] }
  ];

  function getClient() {
    if (window.AuthSystemModule && typeof window.AuthSystemModule.getSupabaseClient === "function") {
      return window.AuthSystemModule.getSupabaseClient();
    }
    return null;
  }

  function resolveChapterId(levelId, explicitChapterId) {
    if (explicitChapterId) return explicitChapterId;
    var s = String(levelId || "");
    if (s.indexOf("CH1") === 0) return "CH-1";
    if (s.indexOf("CH3") === 0) return "CH-3";
    return "CH-2";
  }

  /**
   * 依實際學習證據計算星星評級：
   * - 有效證據不足時：UNRATED（尚未評定）
   * - 證據充足時：ONE_STAR（★☆☆ 需要加強）、TWO_STARS（★★☆ 穩定進步）、THREE_STARS（★★★ 精熟）
   * 不使用寫死分數門檻（如 75/80/95），也不只看答題數量。
   */
  function computeStarRatingFromEvidence(logs) {
    var list = Array.isArray(logs) ? logs : [];
    var graded = list.filter(function (row) {
      return row && (row.ai_verdict === "correct" || row.ai_verdict === "incorrect" || typeof row.ai_verdict === "boolean");
    });

    // 至少需有 2 筆有效作答證據才評定星星，避免單次偶然結果誤判
    if (graded.length < 2) {
      return { rating: "UNRATED", label: "尚未評定", accuracy: null };
    }

    var correctCount = graded.filter(function (row) {
      return row.ai_verdict === "correct" || row.ai_verdict === true;
    }).length;

    var avgHints = graded.reduce(function (acc, row) {
      return acc + Math.max(0, Number(row.hint_count || 0));
    }, 0) / graded.length;

    var ratio = correctCount / graded.length;

    if (ratio >= 0.85 && graded.length >= 3 && avgHints <= 1) {
      return { rating: "THREE_STARS", label: "★★★ 精熟", accuracy: Number(ratio.toFixed(4)) };
    }
    if (ratio >= 0.5 && avgHints <= 2.5) {
      return { rating: "TWO_STARS", label: "★★☆ 穩定進步", accuracy: Number(ratio.toFixed(4)) };
    }
    return { rating: "ONE_STAR", label: "★☆☆ 需要加強", accuracy: Number(ratio.toFixed(4)) };
  }

  async function appendRawAnswerLog(entry) {
    var sb = getClient();
    if (!sb || !entry || !entry.student_id) {
      return { ok: false, message: "尚未登入或 Supabase 尚未初始化" };
    }
    var payload = {
      student_id: entry.student_id,
      chapter_id: resolveChapterId(entry.level_id, entry.chapter_id),
      level_id: String(entry.level_id || "CH2-L1"),
      stage_id: entry.stage_id === "X-2" ? "X-2" : "X-1",
      sub_step: entry.sub_step || null,
      concept_id: entry.concept_id || null,
      question_id: String(entry.question_id || "Q-UNKNOWN"),
      raw_answer: String(entry.raw_answer || ""),
      ai_verdict: entry.ai_verdict != null ? String(entry.ai_verdict) : null,
      ai_reason: entry.ai_reason != null ? String(entry.ai_reason) : null,
      rubric_version: String(entry.rubric_version || "v1"),
      hint_count: Math.max(0, Number(entry.hint_count || 0)),
      duration_seconds: entry.duration_seconds != null ? Math.max(0, Number(entry.duration_seconds)) : null,
      is_completed: Boolean(entry.is_completed),
      is_reviewed_by_teacher: Boolean(entry.is_reviewed_by_teacher)
    };

    var ins = await sb.from("learning_answer_logs").insert([payload]).select().maybeSingle();
    if (ins.error) {
      return { ok: false, message: ins.error.message };
    }
    await recomputeStudentStatistics(entry.student_id, payload.level_id, payload.chapter_id);
    return { ok: true, log: ins.data };
  }

  async function recomputeStudentStatistics(studentId, levelId, chapterId) {
    var sb = getClient();
    if (!sb || !studentId) return null;

    var targetLevel = String(levelId || "CH2-L1");
    var targetChapter = resolveChapterId(targetLevel, chapterId);

    var qRes = await sb
      .from("learning_answer_logs")
      .select("*")
      .eq("student_id", studentId)
      .eq("level_id", targetLevel)
      .order("answered_at", { ascending: true });

    var logs = (qRes && qRes.data) ? qRes.data : [];
    var hasX1 = logs.some(function (r) { return r.stage_id === "X-1" && r.is_completed; });
    var hasX2 = logs.some(function (r) { return r.stage_id === "X-2" && r.is_completed; });
    var levelCompleted = hasX1 && hasX2;
    var starInfo = computeStarRatingFromEvidence(logs);

    // 子觀念統計彙總
    var conceptMap = {};
    logs.forEach(function (r) {
      var cid = r.concept_id || "general";
      if (!conceptMap[cid]) {
        conceptMap[cid] = { attempts: 0, correct: 0 };
      }
      conceptMap[cid].attempts += 1;
      if (r.ai_verdict === "correct" || r.ai_verdict === true) {
        conceptMap[cid].correct += 1;
      }
    });

    var statRow = {
      student_id: studentId,
      chapter_id: targetChapter,
      level_id: targetLevel,
      stage_x1_completed: hasX1,
      stage_x2_completed: hasX2,
      level_completed: levelCompleted,
      chapter_completed: false,
      star_rating: starInfo.rating,
      accuracy_rate: starInfo.accuracy,
      concept_mastery: conceptMap,
      recalculated_at: new Date().toISOString()
    };

    var up = await sb
      .from("learning_statistics")
      .upsert([statRow], { onConflict: "student_id,level_id" })
      .select()
      .maybeSingle();

    return up && up.data ? up.data : statRow;
  }

  async function syncResourcesAndRockets() {
    var sb = getClient();
    if (!sb) return null;
    var r = await sb.rpc("sync_student_stamina_and_rockets", { p_tz: "Asia/Taipei" });
    if (r.error) return null;
    return r.data;
  }

  async function consumeRocketSupply() {
    var sb = getClient();
    if (!sb) return { ok: false, message: "尚未連線 Supabase" };
    var r = await sb.rpc("use_rocket_supply");
    if (r.error) return { ok: false, message: r.error.message };
    return { ok: true, resources: r.data };
  }

  async function applyLearningAction(actionCode, referenceId) {
    var sb = getClient();
    if (!sb) return { ok: false, message: "尚未連線 Supabase" };
    var r = await sb.rpc("apply_learning_action_reward", {
      p_action_code: actionCode,
      p_reference_id: referenceId || null
    });
    if (r.error) return { ok: false, message: r.error.message };
    return { ok: true, resources: r.data };
  }

  async function fetchStudentStatistics(studentId) {
    var sb = getClient();
    if (!sb || !studentId) return [];
    var res = await sb
      .from("learning_statistics")
      .select("*")
      .eq("student_id", studentId)
      .order("level_id", { ascending: true });
    return (res && res.data) ? res.data : [];
  }

  window.LearningStatsAndResourcesModule = {
    CHAPTERS: CHAPTERS,
    computeStarRatingFromEvidence: computeStarRatingFromEvidence,
    appendRawAnswerLog: appendRawAnswerLog,
    recomputeStudentStatistics: recomputeStudentStatistics,
    syncResourcesAndRockets: syncResourcesAndRockets,
    consumeRocketSupply: consumeRocketSupply,
    applyLearningAction: applyLearningAction,
    fetchStudentStatistics: fetchStudentStatistics
  };
})();

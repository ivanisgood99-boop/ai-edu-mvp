(function () {
  "use strict";

  var st = {
    mode: "login",
    subView: "home",
    track: "topic",
    chapterId: "CH-1",
    levelId: "CH1-L1",
    stageCode: "X-1",
    msg: "",
    msgOk: true,
    submitting: false,
    loadingAuth: true,
    loadingData: false,
    user: null,
    profile: null,
    res: null,
    stats: []
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getChapters() {
    if (window.CurriculumDataModule && Array.isArray(window.CurriculumDataModule.chapters)) {
      return window.CurriculumDataModule.chapters;
    }
    return [
      {
        chapterId: "CH-1",
        chapterNumber: 1,
        title: "實數與指對數",
        themeClass: "galaxy-amber-nebula",
        finalAssessment: { title: "實數與指對數・星系最終評量" },
        levels: [
          { levelId: "CH1-L1", levelNumber: 1, title: "實數系與有理化", planetStyle: "planet-amber", prerequisiteConcepts: [] },
          { levelId: "CH1-L2", levelNumber: 2, title: "絕對值與數線距離", planetStyle: "planet-cyan", prerequisiteConcepts: ["CH1-L1 實數系與有理化"] },
          { levelId: "CH1-L3", levelNumber: 3, title: "指數律與次方延伸", planetStyle: "planet-violet", prerequisiteConcepts: ["CH1-L1 實數系與有理化"] },
          { levelId: "CH1-L4", levelNumber: 4, title: "常用對數與科學記號", planetStyle: "planet-emerald", prerequisiteConcepts: ["CH1-L3 指數律與次方延伸"] }
        ]
      }
    ];
  }

  function getStat(levelId) {
    return (st.stats || []).find(function (row) { return row && row.level_id === levelId; }) || null;
  }

  function formatStar(stat) {
    if (stat && stat.mastery_level && stat.mastery_level !== "UNRATED") {
      return stat.mastery_level;
    }
    var r = stat ? stat.star_rating : null;
    if (r === "THREE_STARS") return "★★★ 精熟";
    if (r === "TWO_STARS") return "★★☆ 穩定進步";
    if (r === "ONE_STAR") return "★☆☆ 需要加強";
    return "尚未評定";
  }

  // 新規則：同 Chapter 內所有 Level 預設獨立開放，不綁定前一 Level 是否完成
  function isLevelIndependentUnlocked() {
    return true;
  }

  // 同一 Level 內：觀念學習（X-1）可進入；練習應用（X-2）需觀念學習（X-1）已完成
  function canEnterStage(stat, stageCode) {
    if (stageCode === "X-2") {
      return Boolean(stat && stat.stage_x1_completed);
    }
    return true;
  }

  // 必要 Level 全部完成才解鎖 Chapter 最終評量（排除 isOptional === true 的選修 Level）
  function isChapterFinalUnlocked(ch) {
    var requiredLevels = (ch.levels || []).filter(function (lv) { return !lv.isOptional; });
    if (!requiredLevels.length) return false;
    return requiredLevels.every(function (lv) {
      var s = getStat(lv.levelId);
      return Boolean(s && s.level_completed);
    });
  }
  function renderHome(el) {
    var name = (st.profile && st.profile.display_name) || (st.user && st.user.email) || "學員";
    var role = (st.profile && st.profile.role) || "student";
    var r = st.res;

    var staminaText = st.loadingData ? "載入中..." : (r && typeof r.stamina === "number" ? (r.stamina + " / " + (r.stamina_max || 100)) : "0 / 100");
    var rocketsText = st.loadingData ? "載入中..." : (r && typeof r.rocket_supplies === "number" ? (r.rocket_supplies + " 份") : "0 份");
    var pointsText = st.loadingData ? "載入中..." : (r && typeof r.learning_points === "number" ? (r.learning_points + " 點") : "0 點");
    var doneCount = st.loadingData ? 0 : (st.stats || []).filter(function (x) { return Boolean(x && x.level_completed); }).length;
    var doneText = st.loadingData ? "載入中..." : (doneCount + " 關");

    var html =
      "<div class=\"sh-panel\" style=\"display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px\">" +
      "<div><div style=\"font-size:12px;color:#7dd3fc\">個人資料區・角色：" + esc(role) + "</div>" +
      "<h2 style=\"margin:2px 0\">🚀 " + esc(name) + "</h2>" +
      "<div style=\"font-size:12px;color:#94a3b8\">" + esc(st.user.email || "") + "</div></div>" +
      "<div><button type=\"button\" class=\"sh-btn primary\" id=\"shGoMap\">前往學習地圖</button>" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shLogout\">登出</button></div></div>" +

      "<div class=\"sh-panel\"><h3 style=\"margin:0 0 10px;font-size:15px\">航行與學習狀態</h3>" +
      "<div class=\"sh-grid\">" +
      "<div class=\"sh-card\"><div class=\"sh-card-label\">⚡ 流星體力</div><div class=\"sh-card-num\">" + esc(staminaText) + "</div><div class=\"sh-card-sub\">每 5 分鐘恢復 1 點</div></div>" +
      "<div class=\"sh-card\"><div class=\"sh-card-label\">🚀 火箭補給庫</div><div class=\"sh-card-num\">" + esc(rocketsText) + "</div><button type=\"button\" class=\"sh-btn primary\" id=\"shUseRocket\">使用補給（+50）</button></div>" +
      "<div class=\"sh-card\"><div class=\"sh-card-label\">📘 學習點數</div><div class=\"sh-card-num\">" + esc(pointsText) + "</div><div class=\"sh-card-sub\">以伺服器端紀錄為準</div></div>" +
      "<div class=\"sh-card\"><div class=\"sh-card-label\">🏅 已完成關卡</div><div class=\"sh-card-num\">" + esc(doneText) + "</div><div class=\"sh-card-sub\">各 Level 獨立計算</div></div>" +
      "</div></div>";

    if (st.msg) {
      html += "<div class=\"" + (st.msgOk ? "sh-banner-ok" : "sh-banner-err") + "\">" + esc(st.msg) + "</div>";
    }
    el.innerHTML = "<div class=\"cosmos-scene galaxy-amber-nebula\"><div class=\"cosmos-content\">" + html + "</div></div>";
  }

  function renderMap(el) {
    var chapters = getChapters();
    var ch = chapters.find(function (c) { return c.chapterId === st.chapterId; }) || chapters[0];
    st.chapterId = ch.chapterId;

    var tabsHtml = chapters.map(function (c) {
      var act = c.chapterId === ch.chapterId;
      return "<button type=\"button\" class=\"sh-btn" + (act ? " primary" : "") + "\" data-pick-ch=\"" + esc(c.chapterId) + "\">Chapter " + c.chapterNumber + "：" + esc(c.title) + "</button>";
    }).join("");

    var nodesHtml = (ch.levels || []).map(function (lv, idx) {
      var s = getStat(lv.levelId);
      var x1Done = Boolean(s && s.stage_x1_completed);
      var x2Done = Boolean(s && s.stage_x2_completed);
      var canX2 = canEnterStage(s, "X-2");
      var starLabel = formatStar(s);
      var prereqHint = (Array.isArray(lv.prerequisiteConcepts) && lv.prerequisiteConcepts.length)
        ? "<div style=\"font-size:11px;color:#93c5fd;margin-top:4px\">建議先備概念：" + esc(lv.prerequisiteConcepts.join("、")) + "</div>"
        : "";

      return (
        "<div class=\"map-node-row " + (idx % 2 === 0 ? "zig-left" : "zig-right") + "\">" +
        "<div class=\"planet-node\">" +
        "<div style=\"font-size:15px;font-weight:800\">🪐 Level " + lv.levelNumber + "：" + esc(lv.title) + "</div>" +
        "<span class=\"planet-star-badge\">" + esc(starLabel) + "</span>" +
        prereqHint +
        "<div class=\"planet-stage-list\">" +
        "<div>觀念學習：" + (x1Done ? "已完成" : "未完成") + "</div>" +
        "<div>練習應用：" + (x2Done ? "已完成" : (canX2 ? "未完成" : "需先完成觀念學習")) + "</div>" +
        "</div>" +
        "<div style=\"margin-top:8px\">" +
        "<button type=\"button\" class=\"sh-btn primary\" data-go-lvl=\"" + esc(lv.levelId) + "\" data-go-stg=\"X-1\">觀念學習</button>" +
        "<button type=\"button\" class=\"sh-btn\" " + (canX2 ? "" : "disabled") + " data-go-lvl=\"" + esc(lv.levelId) + "\" data-go-stg=\"X-2\">練習應用</button>" +
        "<button type=\"button\" class=\"sh-btn\" data-open-summary=\"" + esc(lv.levelId) + "\">學習總結與更新精熟度</button>" +
        "</div></div></div>"
      );
    }).join("");

    var finalUnlocked = isChapterFinalUnlocked(ch);
    var megaHtml =
      "<div class=\"final-megastar\">" +
      "<div style=\"font-size:15px;font-weight:800\">✦ " + esc((ch.finalAssessment && ch.finalAssessment.title) || (ch.title + " 最終評量")) + "</div>" +
      "<div style=\"font-size:12px;color:#ddd6fe;margin-top:4px\">" +
      (finalUnlocked ? "已解鎖：本章所有必要 Level 皆已完成。" : "尚未解鎖：需完成本章所有必要 Level 的觀念學習與練習應用。") +
      "</div>" +
      "<button type=\"button\" class=\"sh-btn primary\" " + (finalUnlocked ? "" : "disabled") + " id=\"shMegaExamBtn\">進入最終評量</button>" +
      "</div>";

    var body =
      "<div class=\"sh-panel\">" +
      "<div style=\"display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px\">" +
      "<h2 style=\"margin:0\">🌌 星際學習地圖（各 Level 獨立開放）</h2>" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackHome\">← 返回學生首頁</button>" +
      "</div>" +
      "<div class=\"map-ch-tabs\">" + tabsHtml + "</div>" +
      (st.msg ? "<div class=\"" + (st.msgOk ? "sh-banner-ok" : "sh-banner-err") + "\">" + esc(st.msg) + "</div>" : "") +
      "<div class=\"map-winding-trail\">" + nodesHtml + "</div>" +
      megaHtml +
      "</div>";

    el.innerHTML = "<div class=\"cosmos-scene " + esc(ch.themeClass || "galaxy-amber-nebula") + "\"><div class=\"cosmos-content\">" + body + "</div></div>";
  }

  function renderSummaryPanel(el) {
    var curStat = getStat(st.levelId);
    var curStarText = formatStar(curStat);
    var html =
      "<div class=\"sh-panel\">" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackMapFromSummary\">← 返回學習地圖</button>" +
      "<h2 style=\"margin:10px 0 6px\">學習總結與精熟程度確認（" + esc(st.levelId) + "）</h2>" +
      "<div style=\"font-size:13px;color:#cbd5e1;margin-bottom:10px\">目前伺服器紀錄精熟度：<strong>" + esc(curStarText) + "</strong></div>" +
      "<button type=\"button\" class=\"sh-btn primary\" id=\"shConfirmSummaryBtn\" " + (st.submitting ? "disabled" : "") + ">" +
      (st.submitting ? "正在寫入與重算..." : "確認並更新精熟程度") +
      "</button>";

    if (st.msg) {
      html += "<div class=\"" + (st.msgOk ? "sh-banner-ok" : "sh-banner-err") + "\">" + esc(st.msg) + "</div>";
    }
    html += "</div>";
    el.innerHTML = "<div class=\"cosmos-scene galaxy-amber-nebula\"><div class=\"cosmos-content\">" + html + "</div></div>";
  }

  async function refreshFromServer(target) {
    if (!target || !window.AuthSystemModule) return;
    var s = await window.AuthSystemModule.getCurrentSession();
    st.loadingAuth = false;
    st.user = (s && s.user) ? s.user : null;
    if (!st.user) {
      st.stats = [];
      st.res = null;
      target.innerHTML = "<div class=\"sh-panel\">請先於學生首頁登入正式學生帳號。</div>";
      return;
    }
    st.loadingData = true;
    var b = await window.AuthSystemModule.loadStudentProfileAndResources(st.user);
    st.profile = b.profile;
    st.res = b.resources;
    if (window.LearningStatsAndResourcesModule) {
      var synced = await window.LearningStatsAndResourcesModule.syncResourcesAndRockets();
      if (synced) st.res = synced;
      st.stats = await window.LearningStatsAndResourcesModule.fetchStudentStatistics(st.user.id);
    }
    st.loadingData = false;
    if (st.subView === "map") renderMap(target);
    else if (st.subView === "summary") renderSummaryPanel(target);
    else renderHome(target);
  }

  document.addEventListener("click", async function (ev) {
    var t = ev.target;
    var root = document.getElementById("shStudentStage");
    if (!root || !t) return;

    var chBtn = t.closest ? t.closest("[data-pick-ch]") : null;
    if (chBtn) {
      st.chapterId = chBtn.getAttribute("data-pick-ch") || "CH-1";
      st.msg = "";
      renderMap(root);
      return;
    }

    var sumBtn = t.closest ? t.closest("[data-open-summary]") : null;
    if (sumBtn) {
      st.levelId = sumBtn.getAttribute("data-open-summary") || "CH1-L1";
      st.subView = "summary";
      st.msg = "";
      renderSummaryPanel(root);
      return;
    }

    if (t.closest && t.closest("#shBackMapFromSummary")) {
      st.subView = "map";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("learningMap");
      await refreshFromServer(root);
      return;
    }

    if (t.closest && t.closest("#shConfirmSummaryBtn")) {
      if (st.submitting) return;
      st.submitting = true;
      st.msg = "";
      renderSummaryPanel(root);

      var result = (window.LearningStatsAndResourcesModule && typeof window.LearningStatsAndResourcesModule.commitLearningSummary === "function")
        ? await window.LearningStatsAndResourcesModule.commitLearningSummary({
            studentId: st.user ? st.user.id : null,
            chapterId: st.chapterId,
            levelId: st.levelId,
            stageId: "X-2",
            markStageCompleted: true
          })
        : { ok: false, message: "統計模組未載入，無法儲存。" };

      st.submitting = false;
      st.msgOk = Boolean(result && result.ok);
      st.msg = (result && result.message) || "儲存結果未知";
      if (result && result.ok && Array.isArray(result.stats)) {
        st.stats = result.stats;
      }
      renderSummaryPanel(root);
      return;
    }

    if (t.closest && t.closest("#shGoMap")) {
      st.subView = "map";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("learningMap");
      await refreshFromServer(root);
      return;
    }

    if (t.closest && t.closest("#shBackHome")) {
      st.subView = "home";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("studentHome");
      await refreshFromServer(root);
    }
  });

  window.StudentHomeModule = {
    render: function (target, opts) {
      if (!target) return;
      if (opts && opts.subView) st.subView = opts.subView;
      refreshFromServer(target);
    }
  };
})();

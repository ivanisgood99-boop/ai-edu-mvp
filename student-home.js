/* 學生首頁與獨立學習地圖模組（分段 1/3：狀態與帳號驗證畫面） */
(function () {
  "use strict";

  var ui = {
    mode: "login",          // "login" | "signup" | "forgot"
    activePage: "home",     // "home" | "map"
    learningTrack: "topic", // "topic" | "school"
    preferredLevel: "CH2-L1",
    statusMsg: "",
    statusOk: false,
    submitting: false,
    user: null,
    profile: null,
    resources: null,
    stats: [],
    loading: true
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(ok, msg) {
    ui.statusOk = Boolean(ok);
    ui.statusMsg = String(msg || "");
  }

  function formatStarBadge(rating) {
    if (rating === "THREE_STARS") return "★★★ 精熟";
    if (rating === "TWO_STARS") return "★★☆ 穩定進步";
    if (rating === "ONE_STAR") return "★☆☆ 需要加強";
    return "尚未評定";
  }

  function getStatForLevel(levelId) {
    return (ui.stats || []).find(function (s) { return s.level_id === levelId; }) || null;
  }

  function isLevelUnlocked(chapterObj, idx) {
    if (idx === 0) return true;
    var prevLevelId = chapterObj.levels[idx - 1];
    var prevStat = getStatForLevel(prevLevelId);
    return Boolean(prevStat && prevStat.level_completed);
  }

  function renderAuthGate(target) {
    var isLogin = ui.mode === "login";
    var isSignup = ui.mode === "signup";
    var isForgot = ui.mode === "forgot";
    var titleText = isSignup ? "建立學生帳號" : (isForgot ? "寄送重設信" : "正式登入");

    var fieldsHtml = "";
    if (isSignup) {
      fieldsHtml =
        "<label class=\"sh-field-label\">顯示名稱（非唯一識別）" +
        "<input id=\"auth-name\" class=\"sh-input\" type=\"text\" autocomplete=\"name\" placeholder=\"例如：王小明\"></label>" +
        "<label class=\"sh-field-label\">電子郵件" +
        "<input id=\"auth-email\" class=\"sh-input\" type=\"email\" autocomplete=\"email\" placeholder=\"student@example.com\"></label>" +
        "<label class=\"sh-field-label\">設定密碼（至少 6 碼）" +
        "<input id=\"auth-password\" class=\"sh-input\" type=\"password\" autocomplete=\"new-password\" placeholder=\"請輸入密碼\"></label>";
    } else if (isForgot) {
      fieldsHtml =
        "<label class=\"sh-field-label\">註冊電子郵件（忘記密碼／寄送重設信）" +
        "<input id=\"auth-email\" class=\"sh-input\" type=\"email\" autocomplete=\"email\" placeholder=\"student@example.com\"></label>";
    } else {
      fieldsHtml =
        "<label class=\"sh-field-label\">電子郵件" +
        "<input id=\"auth-email\" class=\"sh-input\" type=\"email\" autocomplete=\"email\" placeholder=\"student@example.com\"></label>" +
        "<label class=\"sh-field-label\">密碼" +
        "<input id=\"auth-password\" class=\"sh-input\" type=\"password\" autocomplete=\"current-password\" placeholder=\"請輸入密碼\"></label>";
    }

    var msgHtml = ui.statusMsg
      ? "<div class=\"sh-msg " + (ui.statusOk ? "ok" : "err") + "\">" + esc(ui.statusMsg) + "</div>"
      : "";

    target.innerHTML =
      "<section class=\"space-home-root nebula-default\" aria-label=\"學生登入與註冊\">" +
      "<div class=\"nebula-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"starfield-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"space-content sh-auth-wrap\">" +
      "<div class=\"sh-panel sh-auth-card\">" +
      "<div class=\"sh-kicker\">✦ 星航智學・學生帳號驗證</div>" +
      "<h1 class=\"sh-title\">請先登入或註冊學生帳號</h1>" +
      "<p class=\"sh-subtitle\">每位學生皆以正式帳號綁定學習紀錄與資源；未登入不會自動建立示範學員。</p>" +
      "<div class=\"sh-tab-row\">" +
      "<button type=\"button\" class=\"sh-mini-btn" + (isLogin ? " primary" : "") + "\" data-auth-tab=\"login\">學生登入</button>" +
      "<button type=\"button\" class=\"sh-mini-btn" + (isSignup ? " primary" : "") + "\" data-auth-tab=\"signup\">學生註冊</button>" +
      "<button type=\"button\" class=\"sh-mini-btn" + (isForgot ? " primary" : "") + "\" data-auth-tab=\"forgot\">忘記密碼</button>" +
      "</div>" +
      "<form id=\"auth-action-form\">" +
      fieldsHtml +
      "<button id=\"auth-submit-btn\" type=\"submit\" class=\"sh-mini-btn primary\" " + (ui.submitting ? "disabled" : "") + ">" +
      (ui.submitting ? "處理中..." : esc(titleText)) +
      "</button>" +
      "</form>" +
      msgHtml +
      "</div>" +
      "</div>" +
      "</section>";
  }
  function renderLearningMap(target) {
    var chapters = (window.LearningStatsAndResourcesModule && window.LearningStatsAndResourcesModule.CHAPTERS) || [
      { id: "CH-1", title: "Chapter 1：數與式", levels: ["CH1-L1", "CH1-L2"] },
      { id: "CH-2", title: "Chapter 2：直線與圓", levels: ["CH2-L1", "CH2-L2"] },
      { id: "CH-3", title: "Chapter 3：多項式", levels: ["CH3-L1", "CH3-L2"] }
    ];

    var displayName = (ui.profile && ui.profile.display_name) || (ui.user && ui.user.email) || "學員";
    var stam = ui.resources && typeof ui.resources.stamina === "number"
      ? (ui.resources.stamina + " / " + (ui.resources.stamina_max || 100))
      : "—";

    var galaxyHtml = chapters.map(function (ch) {
      var planetsHtml = ch.levels.map(function (lvlId, idx) {
        var unlocked = isLevelUnlocked(ch, idx);
        var st = getStatForLevel(lvlId);
        var x1Done = Boolean(st && st.stage_x1_completed);
        var x2Done = Boolean(st && st.stage_x2_completed);
        var starText = formatStarBadge(st && st.star_rating);

        return (
          "<div class=\"sh-planet-card" + (unlocked ? "" : " locked") + "\">" +
          "<div class=\"sh-planet-head\">" +
          "<strong>🪐 " + esc(lvlId) + "</strong>" +
          "<span class=\"sh-star-pill\">" + esc(starText) + "</span>" +
          "</div>" +
          "<div class=\"sh-stage-status\">" +
          "<span>Stage X-1：" + (x1Done ? "已完成" : "未完成") + "</span>" +
          "<span>Stage X-2：" + (x2Done ? "已完成" : (x1Done ? "已解鎖" : "需先完成 X-1")) + "</span>" +
          "</div>" +
          "<div class=\"sh-planet-actions\">" +
          "<button type=\"button\" class=\"sh-mini-btn" + (unlocked ? " primary" : "") + "\" " +
          (unlocked ? "data-launch-level=\"" + esc(lvlId) + "\" data-launch-stage=\"X-1\"" : "disabled") + ">" +
          (unlocked ? "進入 Stage X-1" : "尚未解鎖") +
          "</button>" +
          "<button type=\"button\" class=\"sh-mini-btn\" " +
          (unlocked && x1Done ? "data-launch-level=\"" + esc(lvlId) + "\" data-launch-stage=\"X-2\"" : "disabled") + ">" +
          (unlocked && x1Done ? "進入 Stage X-2" : "X-2 未解鎖") +
          "</button>" +
          "</div>" +
          "</div>"
        );
      }).join("");

      return (
        "<div class=\"sh-galaxy-box\">" +
        "<div class=\"sh-galaxy-top\">" +
        "<h2 class=\"sh-sec-title\">🌌 " + esc(ch.title) + "</h2>" +
        "<button type=\"button\" class=\"sh-mini-btn\" data-chapter-exam=\"" + esc(ch.id) + "\">Chapter 最終評量（消耗 15 能量）</button>" +
        "</div>" +
        "<div class=\"sh-planet-grid\">" + planetsHtml + "</div>" +
        "</div>"
      );
    }).join("");

    target.innerHTML =
      "<section class=\"space-home-root nebula-default\" aria-label=\"星際學習地圖\">" +
      "<div class=\"nebula-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"starfield-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"space-content sh-container\">" +
      "<div class=\"sh-panel sh-topbar\">" +
      "<div>" +
      "<div class=\"sh-kicker\">✦ 學習地圖・模式：" + esc(ui.learningTrack === "school" ? "學校學習" : "主題學習") + "</div>" +
      "<h1 class=\"sh-title\">" + esc(displayName) + " 的星際航線圖</h1>" +
      "</div>" +
      "<div class=\"sh-top-actions\">" +
      "<span class=\"sh-badge\">⚡ 體力 " + esc(stam) + "</span>" +
      "<button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-back-home-btn\">← 返回學生首頁</button>" +
      "</div>" +
      "</div>" +
      (ui.statusMsg ? "<div class=\"sh-msg " + (ui.statusOk ? "ok" : "err") + "\">" + esc(ui.statusMsg) + "</div>" : "") +
      galaxyHtml +
      "</div>" +
      "</section>";
  }

  function renderDashboardHome(target) {
    var displayName = (ui.profile && ui.profile.display_name) || (ui.user && ui.user.email) || "學員";
    var role = (ui.profile && ui.profile.role) || "student";
    var res = ui.resources || {};

    var stamText = typeof res.stamina === "number"
      ? (res.stamina + " / " + (res.stamina_max || 100))
      : "尚未建立資料";
    var rocketsText = typeof res.rocket_supplies === "number" ? String(res.rocket_supplies) : "0";
    var pointsText = typeof res.learning_points === "number" ? String(res.learning_points) : "0";
    var stardustText = typeof res.stardust === "number" ? String(res.stardust) : "0";
    var gemsText = typeof res.gems === "number" ? String(res.gems) : "0";

    var statsList = Array.isArray(ui.stats) ? ui.stats : [];
    var completedLevels = statsList.filter(function (s) { return s.level_completed; }).length;
    var earnedStars = statsList.filter(function (s) {
      return s.star_rating === "ONE_STAR" || s.star_rating === "TWO_STARS" || s.star_rating === "THREE_STARS";
    }).length;

    var latestStat = statsList.length ? statsList[statsList.length - 1] : null;
    var recentTopicText = latestStat ? (latestStat.chapter_id + "・" + latestStat.level_id) : "尚無學習紀錄";
    var pendingStageText = latestStat
      ? (!latestStat.stage_x1_completed ? "待完成 Stage X-1" : (!latestStat.stage_x2_completed ? "待完成 Stage X-2" : "本關已完成，可前往下一關"))
      : "尚未開始（建議從 CH2-L1 Stage X-1 開始）";
    var nextLevelId = latestStat ? latestStat.level_id : "CH2-L1";
    var nextStageId = latestStat && latestStat.stage_x1_completed && !latestStat.stage_x2_completed ? "X-2" : "X-1";

    target.innerHTML =
      "<section class=\"space-home-root nebula-default\" aria-label=\"學生首頁\">" +
      "<div class=\"nebula-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"starfield-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"space-content sh-container\">" +

      "<header class=\"sh-panel sh-profile-bar\">" +
      "<div class=\"sh-profile-main\">" +
      "<div class=\"sh-orbit-avatar\" aria-hidden=\"true\">🚀</div>" +
      "<div>" +
      "<div class=\"sh-kicker\">✦ 個人資料區・身分：" + esc(role) + "</div>" +
      "<h1 class=\"sh-title\">" + esc(displayName) + "</h1>" +
      "<div class=\"sh-submeta\">" + esc(ui.user.email || "") + "</div>" +
      "</div>" +
      "</div>" +
      "<div class=\"sh-top-actions\">" +
      "<button type=\"button\" class=\"sh-mini-btn\" id=\"sh-open-map-btn\">🗺️ 開啟學習地圖</button>" +
      "<button type=\"button\" class=\"sh-mini-btn\" id=\"sh-logout-btn\">登出</button>" +
      "</div>" +
      "</header>" +

      (ui.statusMsg ? "<div class=\"sh-msg " + (ui.statusOk ? "ok" : "err") + "\">" + esc(ui.statusMsg) + "</div>" : "") +

      "<section class=\"sh-panel\" aria-label=\"航行與學習狀態\">" +
      "<h2 class=\"sh-sec-title\">🛸 航行與學習狀態</h2>" +
      "<div class=\"sh-grid-4\">" +
      "<div class=\"sh-stat-card\"><div class=\"sh-stat-label\">⚡ 流星體力</div><div class=\"sh-stat-val\">" + esc(stamText) + "</div><div class=\"sh-stat-note\">每 5 分鐘恢復 1 點</div></div>" +
      "<div class=\"sh-stat-card\"><div class=\"sh-stat-label\">🚀 火箭補給庫</div><div class=\"sh-stat-val\">" + esc(rocketsText) + " 份</div><button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-use-rocket-btn\" style=\"margin-top:8px;\">使用補給（+50）</button></div>" +
      "<div class=\"sh-stat-card\"><div class=\"sh-stat-label\">📘 學習點數</div><div class=\"sh-stat-val\">" + esc(pointsText) + " 點</div><div class=\"sh-stat-note\">星塵 " + esc(stardustText) + "・寶石 " + esc(gemsText) + "</div></div>" +
      "<div class=\"sh-stat-card\"><div class=\"sh-stat-label\">🏅 學習進度與成就</div><div class=\"sh-stat-val\">" + esc(completedLevels) + " 關完成</div><div class=\"sh-stat-note\">已評星 " + esc(earnedStars) + " 關</div></div>" +
      "</div>" +
      "</section>" +

      "<section class=\"sh-panel\" aria-label=\"主要學習入口\">" +
      "<h2 class=\"sh-sec-title\">🧭 主要學習入口</h2>" +
      "<div class=\"sh-mode-row\">" +
      "<button type=\"button\" class=\"sh-mode-card" + (ui.learningTrack === "topic" ? " active" : "") + "\" data-track=\"topic\">" +
      "<strong>主題學習</strong><span>依章節與知識主題探索六階段關卡</span>" +
      "</button>" +
      "<button type=\"button\" class=\"sh-mode-card" + (ui.learningTrack === "school" ? " active" : "") + "\" data-track=\"school\">" +
      "<strong>學校學習</strong><span>對齊課程進度與階段練習，共用熟練度證據</span>" +
      "</button>" +
      "</div>" +
      "</section>" +

      "<div class=\"sh-two-col\">" +
      "<section class=\"sh-panel\" aria-label=\"今日學習\">" +
      "<h2 class=\"sh-sec-title\">📅 今日學習</h2>" +
      "<ul class=\"sh-info-list\">" +
      "<li><strong>今日學習目標：</strong>完成目前關卡 Stage X-1 教材與 Stage X-2 練習</li>" +
      "<li><strong>最近學習內容：</strong>" + esc(recentTopicText) + "</li>" +
      "<li><strong>待完成階段：</strong>" + esc(pendingStageText) + "</li>" +
      "</ul>" +
      "<button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-continue-btn\" data-launch-level=\"" + esc(nextLevelId) + "\" data-launch-stage=\"" + esc(nextStageId) + "\">繼續學習任務（" + esc(nextLevelId) + "・" + esc(nextStageId) + "）</button>" +
      "</section>" +

      "<section class=\"sh-panel\" aria-label=\"成就與進度\">" +
      "<h2 class=\"sh-sec-title\">⭐ 成就與進度</h2>" +
      "<ul class=\"sh-info-list\">" +
      "<li><strong>已完成 Level 數量：</strong>" + esc(String(completedLevels)) + "</li>" +
      "<li><strong>已獲得星星關卡數：</strong>" + esc(String(earnedStars)) + "</li>" +
      "<li><strong>最近成就：</strong>" + (completedLevels > 0 ? "已達成階段學習紀錄" : "尚未解鎖成就（完成關卡後累積）") + "</li>" +
      "</ul>" +
      "</section>" +
      "</div>" +

      "</div>" +
      "</section>";
  }
  async function syncAndRender(target) {
    if (!target) return;
    if (!window.AuthSystemModule) {
      ui.loading = false;
      renderAuthGate(target);
      return;
    }

    try {
      var sess = await window.AuthSystemModule.getCurrentSession();
      ui.loading = false;

      if (!sess || !sess.user) {
        ui.user = null;
        ui.profile = null;
        ui.resources = null;
        ui.stats = [];
        ui.activePage = "home";
        renderAuthGate(target);
        return;
      }

      ui.user = sess.user;
      var bundle = await window.AuthSystemModule.loadStudentProfileAndResources(sess.user);
      ui.profile = bundle.profile;
      ui.resources = bundle.resources;

      if (window.LearningStatsAndResourcesModule) {
        var syncedRes = await window.LearningStatsAndResourcesModule.syncResourcesAndRockets();
        if (syncedRes) ui.resources = syncedRes;
        ui.stats = await window.LearningStatsAndResourcesModule.fetchStudentStatistics(sess.user.id);
      }

      if (ui.activePage === "map") {
        renderLearningMap(target);
      } else {
        renderDashboardHome(target);
      }
    } catch (err) {
      ui.loading = false;
      setStatus(false, "同步資料失敗：" + (err && err.message ? err.message : String(err)));
      renderAuthGate(target);
    }
  }

  async function handleFormSubmit(target) {
    if (ui.submitting) return;
    var emailEl = document.getElementById("auth-email");
    var pwdEl = document.getElementById("auth-password");
    var nameEl = document.getElementById("auth-name");

    var emailVal = emailEl ? emailEl.value.trim() : "";
    var pwdVal = pwdEl ? pwdEl.value : "";
    var nameVal = nameEl ? nameEl.value.trim() : "";

    if (!window.AuthSystemModule) {
      setStatus(false, "找不到 AuthSystemModule，請確認 HTML 已載入 auth-system.js。");
      renderAuthGate(target);
      return;
    }

    ui.submitting = true;
    setStatus(true, "正在連線 Supabase 處理中...");
    renderAuthGate(target);

    try {
      var res;
      if (ui.mode === "signup") {
        res = await window.AuthSystemModule.signUpStudent(emailVal, pwdVal, nameVal);
      } else if (ui.mode === "forgot") {
        res = await window.AuthSystemModule.sendPasswordReset(emailVal, window.location.href);
      } else {
        res = await window.AuthSystemModule.signInStudent(emailVal, pwdVal);
      }

      ui.submitting = false;
      setStatus(Boolean(res && res.ok), (res && res.message) || "完成");

      if (res && res.ok && ui.mode === "login") {
        await syncAndRender(target);
      } else {
        renderAuthGate(target);
      }
    } catch (err) {
      ui.submitting = false;
      setStatus(false, "操作發生錯誤：" + (err && err.message ? err.message : String(err)));
      renderAuthGate(target);
    }
  }

  function getHostContainer(fallbackEl) {
    return document.getElementById("studentHomeRoot") ||
      document.getElementById("view") ||
      document.querySelector("[data-student-home]") ||
      fallbackEl;
  }

  document.addEventListener("click", async function (ev) {
    var host = getHostContainer(ev.target && ev.target.closest ? ev.target.closest(".sh-panel") : null);

    var tabBtn = ev.target && ev.target.closest ? ev.target.closest("[data-auth-tab]") : null;
    if (tabBtn && host) {
      ui.mode = tabBtn.getAttribute("data-auth-tab") || "login";
      setStatus(false, "");
      renderAuthGate(host);
      return;
    }

    var trackCard = ev.target && ev.target.closest ? ev.target.closest("[data-track]") : null;
    if (trackCard && host) {
      ui.learningTrack = trackCard.getAttribute("data-track") || "topic";
      setStatus(true, "已切換至「" + (ui.learningTrack === "school" ? "學校學習" : "主題學習") + "」模式。");
      renderDashboardHome(host);
      return;
    }

    if (ev.target && ev.target.closest && ev.target.closest("#sh-open-map-btn") && host) {
      ui.activePage = "map";
      setStatus(false, "");
      renderLearningMap(host);
      return;
    }

    if (ev.target && ev.target.closest && ev.target.closest("#sh-back-home-btn") && host) {
      ui.activePage = "home";
      setStatus(false, "");
      renderDashboardHome(host);
      return;
    }

    if (ev.target && ev.target.closest && ev.target.closest("#sh-use-rocket-btn") && host) {
      if (window.LearningStatsAndResourcesModule) {
        var r = await window.LearningStatsAndResourcesModule.consumeRocketSupply();
        if (r.ok) {
          ui.resources = r.resources;
          setStatus(true, "已使用 1 份火箭補給，恢復能量。");
        } else {
          setStatus(false, r.message || "無法使用火箭補給");
        }
        renderDashboardHome(host);
      }
      return;
    }

    var launchBtn = ev.target && ev.target.closest ? ev.target.closest("[data-launch-level]") : null;
    if (launchBtn) {
      var lvl = launchBtn.getAttribute("data-launch-level") || "CH2-L1";
      var stg = launchBtn.getAttribute("data-launch-stage") || "X-1";
      if (typeof window.__openTeachingEngineForNode === "function") {
        window.__openTeachingEngineForNode(lvl, stg);
      }
      return;
    }

    var examBtn = ev.target && ev.target.closest ? ev.target.closest("[data-chapter-exam]") : null;
    if (examBtn && host) {
      var chId = examBtn.getAttribute("data-chapter-exam");
      if (window.LearningStatsAndResourcesModule) {
        var exRes = await window.LearningStatsAndResourcesModule.applyLearningAction("CHAPTER_FINAL_ASSESSMENT", chId);
        if (exRes.ok) {
          ui.resources = exRes.resources;
          setStatus(true, chId + " 最終評量完成（消耗 15 能量、獲得 1,500 學習點數，首次完成能量上限 +5）。");
        } else {
          setStatus(false, exRes.message || "無法進行 Chapter 最終評量");
        }
        renderLearningMap(host);
      }
      return;
    }

    if (ev.target && ev.target.closest && ev.target.closest("#sh-logout-btn") && host) {
      setStatus(false, "");
      ui.activePage = "home";
      if (window.AuthSystemModule) {
        await window.AuthSystemModule.signOutStudent();
      }
      await syncAndRender(host);
    }
  });

  document.addEventListener("submit", function (ev) {
    if (ev.target && ev.target.id === "auth-action-form") {
      ev.preventDefault();
      var host = getHostContainer(ev.target.parentElement);
      if (host) handleFormSubmit(host);
    }
  });

  function renderStudentHome(target) {
    if (!target) return;
    if (ui.loading) {
      target.innerHTML = "<div style=\"padding:24px;color:#e2e8f0;\">正在檢查登入狀態與同步資料...</div>";
      syncAndRender(target);
      return;
    }
    if (!ui.user) {
      renderAuthGate(target);
    } else if (ui.activePage === "map") {
      renderLearningMap(target);
    } else {
      renderDashboardHome(target);
    }
  }

  if (window.AuthSystemModule) {
    window.AuthSystemModule.subscribeAuthState(function () {
      var host = getHostContainer(null);
      if (host) syncAndRender(host);
    });
  }

  window.StudentHomeModule = { render: renderStudentHome };
})();

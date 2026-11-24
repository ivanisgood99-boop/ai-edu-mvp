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
    stats: [],
    canvasStop: null
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

  function canEnterStage(stat, stageCode) {
    if (stageCode === "X-2") {
      return Boolean(stat && stat.stage_x1_completed);
    }
    return true;
  }

  function isChapterFinalUnlocked(ch) {
    var requiredLevels = (ch.levels || []).filter(function (lv) { return !lv.isOptional; });
    if (!requiredLevels.length) return false;
    return requiredLevels.every(function (lv) {
      var s = getStat(lv.levelId);
      return Boolean(s && s.level_completed);
    });
  }

  function renderPlanetSvg(styleName, isMega) {
    if (isMega) {
      return (
        "<svg width=\"60\" height=\"60\" viewBox=\"0 0 64 64\" aria-hidden=\"true\">" +
        "<circle cx=\"32\" cy=\"32\" r=\"18\" fill=\"#7c3aed\" stroke=\"#e9d5ff\" stroke-width=\"1.5\"/>" +
        "<ellipse cx=\"32\" cy=\"32\" rx=\"29\" ry=\"8\" fill=\"none\" stroke=\"#67e8f9\" stroke-width=\"1.8\" transform=\"rotate(-18 32 32)\"/>" +
        "</svg>"
      );
    }
    var fill = "#38bdf8", ring = "#bae6fd";
    if (styleName === "planet-amber") { fill = "#f59e0b"; ring = "#fde68a"; }
    else if (styleName === "planet-violet") { fill = "#a855f7"; ring = "#e9d5ff"; }
    else if (styleName === "planet-emerald") { fill = "#10b981"; ring = "#a7f3d0"; }
    return (
      "<svg width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" aria-hidden=\"true\">" +
      "<circle cx=\"24\" cy=\"24\" r=\"13\" fill=\"" + fill + "\"/>" +
      "<ellipse cx=\"24\" cy=\"24\" rx=\"21\" ry=\"5\" fill=\"none\" stroke=\"" + ring + "\" stroke-width=\"1.3\" transform=\"rotate(-12 24 24)\"/>" +
      "</svg>"
    );
  }

  function mountCosmosCanvas(rootEl) {
    if (typeof st.canvasStop === "function") {
      st.canvasStop();
      st.canvasStop = null;
    }
    var cvs = rootEl ? rootEl.querySelector("canvas.cosmos-canvas-bg") : null;
    if (!cvs || !cvs.getContext) return;
    var ctx = cvs.getContext("2d");
    var reduced = false;
    try {
      reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}

    var w = 360, h = 420, raf = 0;
    var stars = [];
    function setup() {
      var rect = rootEl.getBoundingClientRect();
      w = Math.max(280, Math.floor(rect.width || 640));
      h = Math.max(320, Math.floor(rect.height || 480));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cvs.width = Math.floor(w * dpr);
      cvs.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = [];
      for (var i = 0; i < 55; i++) {
        stars.push({
          x: ((i * 97 + 23) % 1000) / 1000 * w,
          y: ((i * 151 + 37) % 1000) / 1000 * h,
          r: (i % 6 === 0) ? 2.0 : 1.1,
          phase: i * 0.6
        });
      }
    }
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      stars.forEach(function (s) {
        var a = reduced ? 0.65 : (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.004 + s.phase)));
        ctx.fillStyle = "rgba(248,250,252," + a.toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduced) raf = window.requestAnimationFrame(frame);
    }
    setup();
    frame(0);
    var onResize = function () { setup(); if (reduced) frame(0); };
    window.addEventListener("resize", onResize);
    st.canvasStop = function () {
      window.removeEventListener("resize", onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }

  function wrapScene(themeClass, innerHtml) {
    return (
      "<div class=\"cosmos-scene " + esc(themeClass || "galaxy-amber-nebula") + "\">" +
      "<canvas class=\"cosmos-canvas-bg\" aria-hidden=\"true\"></canvas>" +
      "<div class=\"cosmos-content\">" + innerHtml + "</div>" +
      "</div>"
    );
  }

  function renderAuth(el) {
    var m = st.mode;
    var submitLabel = m === "signup" ? "建立學生帳號" : (m === "forgot" ? "寄送重設信" : "正式登入");
    var html =
      "<div class=\"sh-panel\" style=\"max-width:520px;margin:0 auto\">" +
      "<div class=\"sh-nav-pill\" style=\"display:inline-block;margin-bottom:6px\">✦ 星航智學・學生帳號登入與註冊</div>" +
      "<h2 style=\"margin:4px 0 6px\">學生登入 / 註冊</h2>" +
      "<p style=\"margin:0 0 12px;font-size:13px;color:#cbd5e1\">請輸入電子郵件與密碼登入，或切換至「學生註冊」建立新帳號。</p>" +
      "<div style=\"margin-bottom:10px\">" +
      "<button type=\"button\" class=\"sh-btn" + (m === "login" ? " primary" : "") + "\" data-auth-mode=\"login\">學生登入</button>" +
      "<button type=\"button\" class=\"sh-btn" + (m === "signup" ? " primary" : "") + "\" data-auth-mode=\"signup\">學生註冊</button>" +
      "<button type=\"button\" class=\"sh-btn" + (m === "forgot" ? " primary" : "") + "\" data-auth-mode=\"forgot\">忘記密碼</button>" +
      "</div>" +
      "<form id=\"shAuthForm\">";

    if (m === "signup") {
      html += "<label style=\"display:block;font-size:13px;margin-top:8px\">顯示名稱<input id=\"shAuthName\" type=\"text\" required placeholder=\"例如：王小明\" style=\"width:100%;padding:9px;margin-top:4px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff\"></label>";
    }
    html += "<label style=\"display:block;font-size:13px;margin-top:8px\">電子郵件<input id=\"shAuthEmail\" type=\"email\" required placeholder=\"student@example.com\" style=\"width:100%;padding:9px;margin-top:4px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff\"></label>";
    if (m !== "forgot") {
      html += "<label style=\"display:block;font-size:13px;margin-top:8px\">密碼（至少 6 碼）<input id=\"shAuthPwd\" type=\"password\" required placeholder=\"請輸入密碼\" style=\"width:100%;padding:9px;margin-top:4px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff\"></label>";
    }
    html += "<button type=\"submit\" class=\"sh-btn primary\" " + (st.submitting ? "disabled" : "") + ">" + (st.submitting ? "處理中..." : esc(submitLabel)) + "</button></form>";
    if (st.msg) {
      html += "<div class=\"" + (st.msgOk ? "sh-banner-ok" : "sh-banner-err") + "\">" + esc(st.msg) + "</div>";
    }
    html += "</div>";
    el.innerHTML = wrapScene("galaxy-amber-nebula", html);
    mountCosmosCanvas(el);
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
    el.innerHTML = wrapScene("galaxy-amber-nebula", html);
    mountCosmosCanvas(el);
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

      return (
        "<div class=\"map-node-row " + (idx % 2 === 0 ? "zig-left" : "zig-right") + "\">" +
        "<div class=\"planet-node\">" +
        "<div class=\"planet-node-head\">" +
        renderPlanetSvg(lv.planetStyle, false) +
        "<div>" +
        "<div style=\"font-size:15px;font-weight:800\">Level " + lv.levelNumber + "：" + esc(lv.title) + "</div>" +
        "<span class=\"planet-star-badge\">" + esc(starLabel) + "</span>" +
        "</div></div>" +
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
      "<div style=\"display:flex;align-items:center;gap:12px;flex-wrap:wrap\">" +
      renderPlanetSvg("", true) +
      "<div style=\"flex:1;min-width:180px\">" +
      "<div style=\"font-size:15px;font-weight:800\">✦ " + esc((ch.finalAssessment && ch.finalAssessment.title) || (ch.title + " 最終評量")) + "</div>" +
      "<div style=\"font-size:12px;color:#ddd6fe;margin-top:4px\">" +
      (finalUnlocked ? "已解鎖：本章所有必要 Level 皆已完成。" : "尚未解鎖：需完成本章所有必要 Level 的觀念學習與練習應用。") +
      "</div></div>" +
      "<button type=\"button\" class=\"sh-btn primary\" " + (finalUnlocked ? "" : "disabled") + " id=\"shMegaExamBtn\">進入最終評量</button>" +
      "</div></div>";

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

    el.innerHTML = wrapScene(ch.themeClass, body);
    mountCosmosCanvas(el);
  }

  function renderStageView(el) {
    var stageTitle = st.stageCode === "X-2" ? "練習應用" : "觀念學習";
    var steps = st.stageCode === "X-2"
      ? ["1. 互動練習", "2. 個人化加強", "3. 學習總結"]
      : ["1. 教材學習", "2. 引導問題", "3. 理解檢查"];

    var lvObj = null;
    getChapters().forEach(function (c) {
      (c.levels || []).forEach(function (l) {
        if (l.levelId === st.levelId) lvObj = l;
      });
    });

    var lessonHtml = (lvObj && Array.isArray(lvObj.lessons) && lvObj.lessons.length)
      ? lvObj.lessons.map(function (txt) { return "<li style=\"margin-bottom:6px\">" + esc(txt) + "</li>"; }).join("")
      : "<li>請依課程概念逐步完成本階段學習。</li>";

    var html =
      "<div class=\"sh-panel\">" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackMapFromStage\">← 返回學習地圖</button>" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackHomeFromStage\">返回學生首頁</button>" +
      "<h2 style=\"margin:10px 0 4px\">" + esc(st.levelId) + (lvObj ? "：" + esc(lvObj.title) : "") + "・" + esc(stageTitle) + "</h2>" +
      "<div style=\"font-size:12px;color:#7dd3fc;margin-bottom:10px\">階段步驟：" + esc(steps.join(" → ")) + "</div>" +
      "<ul style=\"font-size:14px;line-height:1.6;padding-left:20px;margin:0 0 12px\">" + lessonHtml + "</ul>" +
      "<button type=\"button\" class=\"sh-btn primary\" data-open-summary=\"" + esc(st.levelId) + "\">前往學習總結與更新精熟度</button>";

    if (st.msg) html += "<div class=\"" + (st.msgOk ? "sh-banner-ok" : "sh-banner-err") + "\">" + esc(st.msg) + "</div>";
    html += "</div>";
    el.innerHTML = wrapScene("galaxy-amber-nebula", html);
    mountCosmosCanvas(el);
  }

  function renderSummaryPanel(el) {
    var curStat = getStat(st.levelId);
    var html =
      "<div class=\"sh-panel\">" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackMapFromSummary\">← 返回學習地圖</button>" +
      "<h2 style=\"margin:10px 0 6px\">學習總結與精熟程度確認（" + esc(st.levelId) + "）</h2>" +
      "<div style=\"font-size:13px;color:#cbd5e1;margin-bottom:10px\">目前紀錄精熟度：<strong>" + esc(formatStar(curStat)) + "</strong></div>" +
      "<button type=\"button\" class=\"sh-btn primary\" id=\"shConfirmSummaryBtn\" " + (st.submitting ? "disabled" : "") + ">" +
      (st.submitting ? "正在寫入與重算..." : "確認並更新精熟程度") +
      "</button>";
    if (st.msg) html += "<div class=\"" + (st.msgOk ? "sh-banner-ok" : "sh-banner-err") + "\">" + esc(st.msg) + "</div>";
    html += "</div>";
    el.innerHTML = wrapScene("galaxy-amber-nebula", html);
    mountCosmosCanvas(el);
  }

  async function refreshFromServer(target) {
    if (!target) return;
    if (!window.AuthSystemModule) {
      st.loadingAuth = false;
      renderAuth(target);
      return;
    }
    try {
      var s = await window.AuthSystemModule.getCurrentSession();
      st.loadingAuth = false;
      st.user = (s && s.user) ? s.user : null;
      if (!st.user) {
        st.stats = [];
        st.res = null;
        renderAuth(target);
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
      else if (st.subView === "stage") renderStageView(target);
      else if (st.subView === "summary") renderSummaryPanel(target);
      else renderHome(target);
    } catch (e) {
      st.loadingAuth = false;
      st.loadingData = false;
      st.msgOk = false;
      st.msg = "讀取狀態失敗：" + (e && e.message ? e.message : String(e));
      renderAuth(target);
    }
  }

  document.addEventListener("click", async function (ev) {
    var t = ev.target;
    var root = document.getElementById("shStudentStage");
    if (!root || !t) return;

    var modeBtn = t.closest ? t.closest("[data-auth-mode]") : null;
    if (modeBtn) {
      st.mode = modeBtn.getAttribute("data-auth-mode") || "login";
      st.msg = "";
      renderAuth(root);
      return;
    }

    var chBtn = t.closest ? t.closest("[data-pick-ch]") : null;
    if (chBtn) {
      st.chapterId = chBtn.getAttribute("data-pick-ch") || "CH-1";
      st.msg = "";
      renderMap(root);
      return;
    }

    var lvlBtn = t.closest ? t.closest("[data-go-lvl]") : null;
    if (lvlBtn && !lvlBtn.disabled) {
      st.levelId = lvlBtn.getAttribute("data-go-lvl") || "CH1-L1";
      st.stageCode = lvlBtn.getAttribute("data-go-stg") || "X-1";
      st.subView = "stage";
      st.msg = "";
      renderStageView(root);
      return;
    }

    if (t.closest && (t.closest("#shBackMapFromStage") || t.closest("#shBackMapFromSummary"))) {
      st.subView = "map";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("learningMap");
      await refreshFromServer(root);
      return;
    }

    if (t.closest && t.closest("#shBackHomeFromStage")) {
      st.subView = "home";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("studentHome");
      await refreshFromServer(root);
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
      return;
    }

    if (t.closest && t.closest("#shUseRocket")) {
      if (window.LearningStatsAndResourcesModule && typeof window.LearningStatsAndResourcesModule.consumeRocketSupply === "function") {
        var r = await window.LearningStatsAndResourcesModule.consumeRocketSupply();
        st.msgOk = Boolean(r && r.ok);
        st.msg = r && r.ok ? "已使用 1 份火箭補給，恢復能量。" : ((r && r.message) || "無法使用火箭補給");
        if (r && r.ok && r.resources) st.res = r.resources;
      }
      renderHome(root);
      return;
    }

    if (t.closest && t.closest("#shLogout")) {
      st.msg = "";
      st.subView = "home";
      if (window.AuthSystemModule) await window.AuthSystemModule.signOutStudent();
      await refreshFromServer(root);
    }
  });

  document.addEventListener("submit", async function (ev) {
    if (!ev.target || ev.target.id !== "shAuthForm") return;
    ev.preventDefault();
    var root = document.getElementById("shStudentStage");
    if (!root || st.submitting || !window.AuthSystemModule) return;

    var em = (document.getElementById("shAuthEmail") && document.getElementById("shAuthEmail").value.trim()) || "";
    var pw = (document.getElementById("shAuthPwd") && document.getElementById("shAuthPwd").value) || "";
    var nm = (document.getElementById("shAuthName") && document.getElementById("shAuthName").value.trim()) || "";

    st.submitting = true;
    st.msgOk = true;
    st.msg = "正在連線處理中...";
    renderAuth(root);

    var res;
    if (st.mode === "signup") res = await window.AuthSystemModule.signUpStudent(em, pw, nm);
    else if (st.mode === "forgot") res = await window.AuthSystemModule.sendPasswordReset(em, window.location.href);
    else res = await window.AuthSystemModule.signInStudent(em, pw);

    st.submitting = false;
    st.msgOk = Boolean(res && res.ok);
    st.msg = (res && res.message) || "完成";

    if (res && res.ok && st.mode === "login") {
      await refreshFromServer(root);
    } else {
      renderAuth(root);
    }
  });

  if (window.AuthSystemModule && typeof window.AuthSystemModule.subscribeAuthState === "function") {
    window.AuthSystemModule.subscribeAuthState(function () {
      var root = document.getElementById("shStudentStage");
      if (root) refreshFromServer(root);
    });
  }

  window.StudentHomeModule = {
    render: function (target, opts) {
      if (!target) return;
      if (opts && opts.subView) st.subView = opts.subView;
      refreshFromServer(target);
    }
  };
})();

/* 星航智學：學生首頁、彎曲宇宙學習地圖與原創宇宙場景（第 1/3 段） */
(function () {
  "use strict";

  var st = {
    mode: "login",          // "login" | "signup" | "forgot"
    subView: "home",        // "home" | "map" | "engine"
    track: "topic",         // "topic" | "school"
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
        finalAssessment: { id: "FINAL-CH-1", title: "實數與指對數・星系最終評量" },
        levels: [
          { levelId: "CH1-L1", levelNumber: 1, title: "實數系與有理化", planetStyle: "planet-amber" },
          { levelId: "CH1-L2", levelNumber: 2, title: "絕對值與數線距離", planetStyle: "planet-cyan" },
          { levelId: "CH1-L3", levelNumber: 3, title: "指數律與次方延伸", planetStyle: "planet-violet" },
          { levelId: "CH1-L4", levelNumber: 4, title: "常用對數與科學記號", planetStyle: "planet-emerald" }
        ]
      }
    ];
  }

  function starTextFromRating(r) {
    if (r === "THREE_STARS") return "★★★ 精熟";
    if (r === "TWO_STARS") return "★★☆ 穩定進步";
    if (r === "ONE_STAR") return "★☆☆ 需要加強";
    return "尚未評定";
  }

  function findStat(levelId) {
    return (st.stats || []).find(function (x) { return x.level_id === levelId; }) || null;
  }

  function canOpenLevel(ch, idx) {
    if (idx === 0) return true;
    var prevId = ch.levels[idx - 1].levelId;
    var prevStat = findStat(prevId);
    return Boolean(prevStat && prevStat.level_completed);
  }

  function renderPlanetSvg(styleName, isMega) {
    if (isMega) {
      return (
        "<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" aria-hidden=\"true\">" +
        "<circle cx=\"32\" cy=\"32\" r=\"18\" fill=\"#7c3aed\" stroke=\"#e9d5ff\" stroke-width=\"1.5\"/>" +
        "<ellipse cx=\"32\" cy=\"32\" rx=\"29\" ry=\"8\" fill=\"none\" stroke=\"#67e8f9\" stroke-width=\"1.8\" transform=\"rotate(-18 32 32)\"/>" +
        "<circle cx=\"52\" cy=\"16\" r=\"4\" fill=\"#fde047\"/>" +
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
      "<circle cx=\"19\" cy=\"19\" r=\"3\" fill=\"rgba(15,23,42,0.28)\"/>" +
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
    var rocks = [];

    function setup() {
      var rect = rootEl.getBoundingClientRect();
      w = Math.max(280, Math.floor(rect.width || 640));
      h = Math.max(320, Math.floor(rect.height || 480));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cvs.width = Math.floor(w * dpr);
      cvs.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars = [];
      for (var i = 0; i < 65; i++) {
        stars.push({
          x: ((i * 89 + 17) % 1000) / 1000 * w,
          y: ((i * 157 + 43) % 1000) / 1000 * h,
          r: (i % 7 === 0) ? 2.1 : ((i % 3 === 0) ? 1.4 : 0.9),
          phase: i * 0.65
        });
      }
      rocks = [
        { x: w * 0.15, y: h * 0.22, vx: 0.12, vy: 0.04, r: 4 },
        { x: w * 0.82, y: h * 0.65, vx: -0.1, vy: 0.05, r: 5 }
      ];
    }

    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      var g1 = ctx.createRadialGradient(w * 0.2, h * 0.2, 4, w * 0.2, h * 0.2, 65);
      g1.addColorStop(0, "rgba(186,230,253,0.16)");
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(w * 0.2, h * 0.2, 65, 0, Math.PI * 2);
      ctx.fill();

      stars.forEach(function (s) {
        var a = reduced ? 0.65 : (0.3 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.004 + s.phase)));
        ctx.fillStyle = "rgba(248,250,252," + a.toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.strokeStyle = "rgba(148,163,184,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.36, 0, Math.PI * 2);
      ctx.stroke();

      rocks.forEach(function (rk) {
        if (!reduced) {
          rk.x += rk.vx;
          rk.y += rk.vy;
          if (rk.x < -10) rk.x = w + 10;
          if (rk.x > w + 10) rk.x = -10;
        }
        ctx.fillStyle = "rgba(148,163,184,0.55)";
        ctx.beginPath();
        ctx.arc(rk.x, rk.y, rk.r, 0, Math.PI * 2);
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
      "<svg class=\"cosmos-mid-svg\" viewBox=\"0 0 800 500\" preserveAspectRatio=\"none\" aria-hidden=\"true\">" +
      "<path d=\"M-40 120 Q220 40 440 160 T900 130\" fill=\"none\" stroke=\"rgba(56,189,248,0.22)\" stroke-width=\"2\" stroke-dasharray=\"6 6\"/>" +
      "<path d=\"M-20 390 Q280 290 520 380 T860 320\" fill=\"none\" stroke=\"rgba(192,132,252,0.2)\" stroke-width=\"1.8\"/>" +
      "</svg>" +
      "<div class=\"cosmos-content\">" + innerHtml + "</div>" +
      "</div>"
    );
  }

  function renderAuth(el) {
    var m = st.mode;
    var submitLabel = m === "signup" ? "建立學生帳號" : (m === "forgot" ? "寄送重設信" : "正式登入");
    var html =
      "<div class=\"sh-panel\" style=\"max-width:520px;margin:0 auto\">" +
      "<div class=\"sh-nav-pill\" style=\"display:inline-block;margin-bottom:6px\">✦ 星航智學・學生身分驗證</div>" +
      "<h2 style=\"margin:4px 0 6px\">請先登入或註冊學生帳號</h2>" +
      "<p style=\"margin:0 0 12px;font-size:13px;color:#cbd5e1\">登入後可查看個人學習狀態、進入星際學習地圖與六階段教學。</p>" +
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
    var doneCount = st.loadingData ? 0 : (st.stats || []).filter(function (x) { return x.level_completed; }).length;
    var doneText = st.loadingData ? "載入中..." : (doneCount + " 關");
    var starCount = st.loadingData ? 0 : (st.stats || []).filter(function (x) {
      return x.star_rating === "ONE_STAR" || x.star_rating === "TWO_STARS" || x.star_rating === "THREE_STARS";
    }).length;

    var latest = (st.stats && st.stats.length) ? st.stats[st.stats.length - 1] : null;
    var recentLabel = latest ? (latest.chapter_id + "・" + latest.level_id) : "尚無學習紀錄";
    var pendingLabel = latest
      ? (!latest.stage_x1_completed ? "觀念學習：未完成" : (!latest.stage_x2_completed ? "練習應用：未完成" : "已完成本關，可前往下一關"))
      : "觀念學習：未完成";

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
      "<div class=\"sh-card\"><div class=\"sh-card-label\">📘 學習點數</div><div class=\"sh-card-num\">" + esc(pointsText) + "</div><div class=\"sh-card-sub\">依實際學習行為發放</div></div>" +
      "<div class=\"sh-card\"><div class=\"sh-card-label\">🏅 已完成關卡</div><div class=\"sh-card-num\">" + esc(doneText) + "</div><div class=\"sh-card-sub\">已獲星關卡：" + esc(String(starCount)) + " 關</div></div>" +
      "</div></div>" +

      "<div class=\"sh-panel\"><h3 style=\"margin:0 0 10px;font-size:15px\">主要學習入口</h3>" +
      "<button type=\"button\" class=\"sh-btn" + (st.track === "topic" ? " primary" : "") + "\" data-track=\"topic\">主題學習</button>" +
      "<button type=\"button\" class=\"sh-btn" + (st.track === "school" ? " primary" : "") + "\" data-track=\"school\">學校學習</button>" +
      "<div style=\"font-size:12px;color:#cbd5e1;margin-top:8px\">目前模式：" + esc(st.track === "school" ? "學校學習" : "主題學習") + "（共用熟練度證據，各自保留路徑）</div></div>" +

      "<div class=\"sh-grid\" style=\"margin-bottom:14px\">" +
      "<div class=\"sh-panel\" style=\"margin:0\"><h3 style=\"margin:0 0 8px;font-size:15px\">今日學習</h3>" +
      "<div style=\"font-size:13px;color:#e2e8f0\">• 今日目標：完成目前關卡「觀念學習」與「練習應用」</div>" +
      "<div style=\"font-size:13px;color:#e2e8f0;margin-top:4px\">• 最近學習：" + esc(recentLabel) + "</div>" +
      "<div style=\"font-size:13px;color:#e2e8f0;margin-top:4px\">• 待完成階段：" + esc(pendingLabel) + "</div>" +
      "<button type=\"button\" class=\"sh-btn primary\" id=\"shContinueBtn\">繼續學習任務</button></div>" +

      "<div class=\"sh-panel\" style=\"margin:0\"><h3 style=\"margin:0 0 8px;font-size:15px\">成就與進度</h3>" +
      "<div style=\"font-size:13px;color:#e2e8f0\">• 連續學習天數：0 天（依實際紀錄累計）</div>" +
      "<div style=\"font-size:13px;color:#e2e8f0;margin-top:4px\">• 已完成 Level 數量：" + esc(doneText) + "</div>" +
      "<div style=\"font-size:13px;color:#e2e8f0;margin-top:4px\">• 已獲得星星關卡：" + esc(String(starCount)) + " 關</div>" +
      "<div style=\"font-size:13px;color:#e2e8f0;margin-top:4px\">• 最近成就：" + (doneCount > 0 ? "已達成階段學習" : "尚未解鎖成就") + "</div></div>" +
      "</div>";

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

    var allDone = (ch.levels || []).length > 0 && (ch.levels || []).every(function (lv) {
      var s = findStat(lv.levelId);
      return Boolean(s && s.level_completed);
    });

    var trailHtml = (ch.levels || []).map(function (lv, idx) {
      var unlocked = canOpenLevel(ch, idx);
      var s = findStat(lv.levelId);
      var x1Done = Boolean(s && s.stage_x1_completed);
      var x2Done = Boolean(s && s.stage_x2_completed);
      var starBadge = starTextFromRating(s && s.star_rating);
      var zigClass = idx % 2 === 0 ? "zig-left" : "zig-right";

      return (
        "<div class=\"map-node-row " + zigClass + "\">" +
        "<div class=\"planet-node" + (unlocked ? "" : " is-locked") + "\">" +
        "<div class=\"planet-node-head\">" +
        renderPlanetSvg(lv.planetStyle, false) +
        "<div>" +
        "<div style=\"font-size:15px;font-weight:800\">Level " + lv.levelNumber + "：" + esc(lv.title) + "</div>" +
        "<div style=\"font-size:12px;color:#cbd5e1\">" + esc(lv.textbookVersion || "") + "</div>" +
        "<span class=\"planet-star-badge\">" + esc(starBadge) + "</span>" +
        "</div></div>" +
        "<div class=\"planet-stage-list\">" +
        "<div>觀念學習：" + (x1Done ? "已完成" : "未完成") + "（1.教材學習／2.引導問題／3.理解檢查）</div>" +
        "<div style=\"margin-top:3px\">練習應用：" + (x2Done ? "已完成" : (x1Done ? "未完成" : "需先完成觀念學習")) + "（1.互動練習／2.個人化加強／3.學習總結）</div>" +
        "</div>" +
        "<div style=\"margin-top:8px\">" +
        "<button type=\"button\" class=\"sh-btn" + (unlocked ? " primary" : "") + "\" " + (unlocked ? "" : "disabled") + " data-go-lvl=\"" + esc(lv.levelId) + "\" data-go-stg=\"X-1\">" + (unlocked ? "觀念學習" : "尚未解鎖") + "</button>" +
        "<button type=\"button\" class=\"sh-btn\" " + ((unlocked && x1Done) ? "" : "disabled") + " data-go-lvl=\"" + esc(lv.levelId) + "\" data-go-stg=\"X-2\">" + ((unlocked && x1Done) ? "練習應用" : "練習應用未解鎖") + "</button>" +
        "</div>" +
        "</div></div>"
      );
    }).join("");

    var megaHtml =
      "<div class=\"final-megastar\">" +
      "<div style=\"display:flex;align-items:center;gap:12px;flex-wrap:wrap\">" +
      renderPlanetSvg("", true) +
      "<div style=\"flex:1;min-width:200px\">" +
      "<div style=\"font-size:12px;color:#e9d5ff;font-weight:700\">✦ 星系核心最終評量</div>" +
      "<div style=\"font-size:16px;font-weight:800\">" + esc((ch.finalAssessment && ch.finalAssessment.title) || (ch.title + " 最終評量")) + "</div>" +
      "<div style=\"font-size:12px;color:#ddd6fe\">" + (allDone ? "已解鎖：可進行 Chapter 最終評量" : "尚未解鎖：需完成本章所有 Level 的觀念學習與練習應用") + "</div>" +
      "</div>" +
      "<button type=\"button\" class=\"sh-btn primary\" " + (allDone ? "" : "disabled") + " id=\"shMegaExamBtn\">進入最終評量</button>" +
      "</div></div>";

    var bodyHtml =
      "<div class=\"sh-panel\">" +
      "<div style=\"display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px\">" +
      "<div><h2 style=\"margin:0\">🌌 星際學習地圖</h2><div style=\"font-size:12px;color:#cbd5e1\">依序解鎖關卡：完成前一關全部階段後解鎖下一關</div></div>" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackHome\">← 返回學生首頁</button>" +
      "</div>" +
      "<div class=\"map-ch-tabs\">" + tabsHtml + "</div>" +
      "<div class=\"map-winding-trail\">" + trailHtml + "</div>" +
      megaHtml +
      (st.msg ? "<div class=\"" + (st.msgOk ? "sh-banner-ok" : "sh-banner-err") + "\">" + esc(st.msg) + "</div>" : "") +
      "</div>";

    el.innerHTML = wrapScene(ch.themeClass, bodyHtml);
    mountCosmosCanvas(el);
  }

  function renderEngineView(el) {
    el.innerHTML =
      "<div class=\"sh-panel\">" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackMapFromEng\">← 返回學習地圖</button>" +
      "<button type=\"button\" class=\"sh-btn\" id=\"shBackHomeFromEng\">返回學生首頁</button>" +
      "<span style=\"font-size:12px;color:#7dd3fc;margin-left:8px\">關卡：" + esc(st.levelId) + "・" + esc(st.stageCode === "X-2" ? "練習應用" : "觀念學習") + "</span>" +
      "<div id=\"shTeMount\" style=\"margin-top:12px\"></div>" +
      "</div>";

    if (window.TeachingEngineModule && typeof window.TeachingEngineModule.render === "function") {
      window.TeachingEngineModule.render(document.getElementById("shTeMount"), st.levelId);
    } else {
      document.getElementById("shTeMount").innerHTML = "<div style=\"font-size:13px;color:#cbd5e1\">教學引擎尚未載入，請確認 teaching-engine.js 路徑。</div>";
    }
  }
  async function syncSessionAndData(target) {
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
        st.profile = null;
        st.res = null;
        st.stats = [];
        st.subView = "home";
        renderAuth(target);
        return;
      }

      st.loadingData = true;
      renderCurrentView(target);

      var b = await window.AuthSystemModule.loadStudentProfileAndResources(st.user);
      st.profile = b.profile;
      st.res = b.resources;

      if (window.LearningStatsAndResourcesModule) {
        var synced = await window.LearningStatsAndResourcesModule.syncResourcesAndRockets();
        if (synced) st.res = synced;
        st.stats = await window.LearningStatsAndResourcesModule.fetchStudentStatistics(st.user.id);
      }
      st.loadingData = false;
      renderCurrentView(target);
    } catch (e) {
      st.loadingAuth = false;
      st.loadingData = false;
      st.msgOk = false;
      st.msg = "讀取資料時發生錯誤：" + (e && e.message ? e.message : String(e));
      renderAuth(target);
    }
  }

  function renderCurrentView(target) {
    if (!target) return;
    if (st.loadingAuth) {
      target.innerHTML = "<div class=\"sh-panel\">正在確認登入狀態...</div>";
      return;
    }
    if (!st.user) {
      renderAuth(target);
      return;
    }
    if (st.subView === "map") renderMap(target);
    else if (st.subView === "engine") renderEngineView(target);
    else renderHome(target);
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

    if (t.closest && t.closest("#shGoMap")) {
      st.subView = "map";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("learningMap");
      renderMap(root);
      return;
    }

    if (t.closest && (t.closest("#shBackHome") || t.closest("#shBackHomeFromEng"))) {
      st.subView = "home";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("studentHome");
      renderHome(root);
      return;
    }

    if (t.closest && t.closest("#shBackMapFromEng")) {
      st.subView = "map";
      st.msg = "";
      if (typeof window.__onStudentSubViewChange === "function") window.__onStudentSubViewChange("learningMap");
      renderMap(root);
      return;
    }

    var trackBtn = t.closest ? t.closest("[data-track]") : null;
    if (trackBtn) {
      st.track = trackBtn.getAttribute("data-track") || "topic";
      st.msgOk = true;
      st.msg = "已切換至「" + (st.track === "school" ? "學校學習" : "主題學習") + "」";
      renderHome(root);
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

    if (t.closest && t.closest("#shContinueBtn")) {
      st.subView = "engine";
      renderEngineView(root);
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
      st.subView = "engine";
      renderEngineView(root);
      return;
    }

    if (t.closest && t.closest("#shLogout")) {
      st.msg = "";
      st.subView = "home";
      if (window.AuthSystemModule) await window.AuthSystemModule.signOutStudent();
      await syncSessionAndData(root);
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
      await syncSessionAndData(root);
    } else {
      renderAuth(root);
    }
  });

  function render(target, options) {
    if (!target) return;
    if (options && options.subView) st.subView = options.subView;
    if (st.loadingAuth) {
      target.innerHTML = "<div class=\"sh-panel\">正在確認登入狀態...</div>";
      syncSessionAndData(target);
      return;
    }
    if (!st.user) {
      renderAuth(target);
      return;
    }
    if (st.subView === "map") renderMap(target);
    else if (st.subView === "engine") renderEngineView(target);
    else renderHome(target);
  }

  if (window.AuthSystemModule && typeof window.AuthSystemModule.subscribeAuthState === "function") {
    window.AuthSystemModule.subscribeAuthState(function () {
      var root = document.getElementById("shStudentStage");
      if (root) syncSessionAndData(root);
    });
  }

  window.StudentHomeModule = { render: render };
})();

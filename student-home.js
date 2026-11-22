/* 學生端宇宙探索地圖：體力、星塵、探索度、軌道連線、每日任務、快問快答與 Stage 嚴格解鎖 */
(function () {
  "use strict";

  var MAX_STAMINA = 5;
  var STAMINA_KEY = "ai_edu_cosmos_stamina_v1";

  var state = {
    activeChapterId: "CH-2",
    selectedLevelId: "CH2-L1",
    infoDrawer: null,
    quickQuizAnswer: "",
    quickQuizFeedback: "",
    canvasCleanup: null
  };

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getStudentName() {
    var el = document.getElementById("stuInp");
    var v = el && el.value ? el.value.trim() : "";
    var ls = (localStorage.getItem("edu_stu") || "").trim();
    return v || ls || "訪客學員";
  }

  function getStaminaData(sid) {
    var map = {};
    try {
      var raw = localStorage.getItem(STAMINA_KEY);
      map = raw ? JSON.parse(raw) : {};
    } catch (e) {
      map = {};
    }
    var key = sid || "訪客學員";
    if (!map[key] || typeof map[key].stamina !== "number") {
      map[key] = { stamina: MAX_STAMINA, stardust: 0 };
      try { localStorage.setItem(STAMINA_KEY, JSON.stringify(map)); } catch (e2) {}
    }
    return { map: map, key: key, data: map[key] };
  }

  function saveStaminaData(sid, nextData) {
    var sObj = getStaminaData(sid);
    sObj.map[sObj.key] = {
      stamina: Math.max(0, Math.min(MAX_STAMINA, nextData.stamina)),
      stardust: Math.max(0, nextData.stardust)
    };
    try { localStorage.setItem(STAMINA_KEY, JSON.stringify(sObj.map)); } catch (e) {}
    return sObj.map[sObj.key];
  }

  function getFallbackChapters() {
    return {
      "CH-1": {
        chapterId: "CH-1",
        chapterNumber: 1,
        title: "數與式",
        galaxyStyle: "nebula-amber-blue",
        levels: [
          { levelId: "CH1-L1", levelNumber: 1, title: "正整數次方", planetStyle: "planet-crater-amber" },
          { levelId: "CH1-L2", levelNumber: 2, title: "零次方", planetStyle: "planet-ring-cyan" }
        ]
      },
      "CH-2": {
        chapterId: "CH-2",
        chapterNumber: 2,
        title: "直線與圓",
        galaxyStyle: "nebula-default",
        levels: [
          { levelId: "CH2-L1", levelNumber: 1, title: "坐標平面與點的關係", planetStyle: "planet-crater-amber" },
          { levelId: "CH2-L2", levelNumber: 2, title: "直線的斜率", planetStyle: "planet-ring-violet" },
          { levelId: "CH2-L3", levelNumber: 3, title: "直線方程式", planetStyle: "planet-grid-blue" },
          { levelId: "CH2-L4", levelNumber: 4, title: "圓的基本概念與方程式", planetStyle: "planet-ring-cyan" },
          { levelId: "CH2-L5", levelNumber: 5, title: "直線與圓的位置關係", planetStyle: "planet-grid-blue" },
          { levelId: "CH2-L6", levelNumber: 6, title: "直線與圓的綜合應用", planetStyle: "planet-ring-violet" }
        ]
      },
      "CH-3": {
        chapterId: "CH-3",
        chapterNumber: 3,
        title: "多項式",
        galaxyStyle: "nebula-violet-teal",
        levels: [
          { levelId: "CH3-L1", levelNumber: 1, title: "多項式的定義與運算", planetStyle: "planet-crater-amber" },
          { levelId: "CH3-L2", levelNumber: 2, title: "餘式定理與因式定理", planetStyle: "planet-ring-cyan" }
        ]
      }
    };
  }

  function buildChapterCompletion(sid, chObj) {
    var eng = window.TeachingEngineModule;
    if (eng && typeof eng.getChapterCompletion === "function") {
      return eng.getChapterCompletion(sid, chObj.chapterId);
    }

    var levels = (chObj.levels || []).map(function (lv, idx) {
      var s1Unlocked = idx === 0;
      return {
        levelId: lv.levelId,
        levelNumber: lv.levelNumber,
        title: lv.title,
        planetStyle: lv.planetStyle,
        s1: {
          code: lv.levelNumber + "-1",
          title: "觀念學習",
          unlocked: s1Unlocked,
          completed: false,
          status: s1Unlocked ? "available" : "locked",
          statusText: s1Unlocked
            ? "目前可進行 Stage " + lv.levelNumber + "-1｜觀念學習。"
            : "完成前一關卡，才能解鎖 Stage " + lv.levelNumber + "-1｜觀念學習。"
        },
        s2: {
          code: lv.levelNumber + "-2",
          title: "刷題練習",
          unlocked: false,
          completed: false,
          status: "locked",
          statusText: "完成 Stage " + lv.levelNumber + "-1｜觀念學習，才能解鎖 Stage " + lv.levelNumber + "-2｜刷題練習。"
        },
        stage1Completed: false,
        stage2Unlocked: false,
        stage2Completed: false,
        levelCompleted: false,
        starCode: "UNRATED",
        starLabel: "尚未評定",
        missingReasons: []
      };
    });

    return {
      chapterId: chObj.chapterId,
      completedCount: 0,
      totalCount: levels.length,
      allCompleted: false,
      levels: levels
    };
  }

  function renderPlanetArtwork(styleName, isFinal, idx) {
    if (isFinal) {
      return (
        "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 88 88\" width=\"76\" height=\"76\" aria-hidden=\"true\">" +
        "<defs><radialGradient id=\"pFinal_" + idx + "\" cx=\"32%\" cy=\"28%\"><stop offset=\"0%\" stop-color=\"#99F6E4\"/><stop offset=\"58%\" stop-color=\"#0284C7\"/><stop offset=\"100%\" stop-color=\"#090D16\"/></radialGradient></defs>" +
        "<circle cx=\"44\" cy=\"44\" r=\"21\" fill=\"url(#pFinal_" + idx + ")\"/>" +
        "<ellipse cx=\"44\" cy=\"44\" rx=\"39\" ry=\"11\" fill=\"none\" stroke=\"#5EEAD4\" stroke-width=\"2\" transform=\"rotate(-16 44 44)\"/>" +
        "<circle cx=\"44\" cy=\"44\" r=\"29\" fill=\"none\" stroke=\"#C084FC\" stroke-width=\"1.2\" stroke-dasharray=\"4 3\"/>" +
        "<circle cx=\"72\" cy=\"24\" r=\"4\" fill=\"#FDE68A\"/>" +
        "</svg>"
      );
    }
    if (styleName === "planet-ring-cyan") {
      return (
        "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 88 88\" width=\"72\" height=\"72\" aria-hidden=\"true\">" +
        "<defs><radialGradient id=\"pCyan_" + idx + "\" cx=\"30%\" cy=\"26%\"><stop offset=\"0%\" stop-color=\"#BAE6FD\"/><stop offset=\"65%\" stop-color=\"#1D4ED8\"/><stop offset=\"100%\" stop-color=\"#070B1A\"/></radialGradient></defs>" +
        "<circle cx=\"44\" cy=\"44\" r=\"21\" fill=\"url(#pCyan_" + idx + ")\"/>" +
        "<path d=\"M18 40 Q44 30 70 42\" fill=\"none\" stroke=\"#2DD4BF\" stroke-width=\"2\"/>" +
        "<ellipse cx=\"44\" cy=\"46\" rx=\"37\" ry=\"9\" fill=\"none\" stroke=\"#38BDF8\" stroke-width=\"2\" transform=\"rotate(14 44 46)\"/>" +
        "<circle cx=\"16\" cy=\"22\" r=\"3.5\" fill=\"#CBD5E1\"/>" +
        "</svg>"
      );
    }
    if (styleName === "planet-ring-violet") {
      return (
        "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 88 88\" width=\"72\" height=\"72\" aria-hidden=\"true\">" +
        "<defs><radialGradient id=\"pViol_" + idx + "\" cx=\"30%\" cy=\"26%\"><stop offset=\"0%\" stop-color=\"#F3E8FF\"/><stop offset=\"65%\" stop-color=\"#7E22CE\"/><stop offset=\"100%\" stop-color=\"#070B1A\"/></radialGradient></defs>" +
        "<circle cx=\"44\" cy=\"44\" r=\"21\" fill=\"url(#pViol_" + idx + ")\"/>" +
        "<path d=\"M24 36 Q44 45 64 36\" fill=\"none\" stroke=\"rgba(248,250,252,0.4)\" stroke-width=\"1.5\"/>" +
        "<circle cx=\"69\" cy=\"22\" r=\"5\" fill=\"#38BDF8\"/>" +
        "<path d=\"M10 44 Q44 12 78 44\" fill=\"none\" stroke=\"rgba(192,132,252,0.5)\" stroke-width=\"1.3\" stroke-dasharray=\"3 3\"/>" +
        "</svg>"
      );
    }
    if (styleName === "planet-grid-blue") {
      return (
        "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 88 88\" width=\"72\" height=\"72\" aria-hidden=\"true\">" +
        "<defs><radialGradient id=\"pGrid_" + idx + "\" cx=\"32%\" cy=\"26%\"><stop offset=\"0%\" stop-color=\"#A5F3FC\"/><stop offset=\"60%\" stop-color=\"#0369A1\"/><stop offset=\"100%\" stop-color=\"#070B1A\"/></radialGradient></defs>" +
        "<circle cx=\"44\" cy=\"44\" r=\"21\" fill=\"url(#pGrid_" + idx + ")\"/>" +
        "<ellipse cx=\"44\" cy=\"44\" rx=\"21\" ry=\"7\" fill=\"none\" stroke=\"rgba(248,250,252,0.35)\" stroke-width=\"1\"/>" +
        "<ellipse cx=\"44\" cy=\"44\" rx=\"7\" ry=\"21\" fill=\"none\" stroke=\"rgba(248,250,252,0.35)\" stroke-width=\"1\"/>" +
        "<circle cx=\"66\" cy=\"62\" r=\"3.5\" fill=\"#5EEAD4\"/>" +
        "</svg>"
      );
    }
    return (
      "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 88 88\" width=\"72\" height=\"72\" aria-hidden=\"true\">" +
      "<defs><radialGradient id=\"pCrat_" + idx + "\" cx=\"30%\" cy=\"26%\"><stop offset=\"0%\" stop-color=\"#FEF08A\"/><stop offset=\"58%\" stop-color=\"#D97706\"/><stop offset=\"100%\" stop-color=\"#070B1A\"/></radialGradient></defs>" +
      "<circle cx=\"44\" cy=\"44\" r=\"21\" fill=\"url(#pCrat_" + idx + ")\"/>" +
      "<circle cx=\"34\" cy=\"35\" r=\"4.5\" fill=\"rgba(15,23,42,0.35)\"/>" +
      "<circle cx=\"51\" cy=\"49\" r=\"3.5\" fill=\"rgba(15,23,42,0.3)\"/>" +
      "<circle cx=\"38\" cy=\"54\" r=\"2.5\" fill=\"rgba(15,23,42,0.25)\"/>" +
      "</svg>"
    );
  }

  function initCosmosCanvas(rootEl) {
    if (typeof state.canvasCleanup === "function") {
      state.canvasCleanup();
      state.canvasCleanup = null;
    }
    var canvas = rootEl ? rootEl.querySelector("canvas.cosmos-star-canvas") : null;
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var reducedMotion = false;
    try {
      reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}

    var w = 0, h = 0, rafId = 0, stars = [], asteroids = [], galaxies = [];

    function resizeAndSeed() {
      var rect = rootEl.getBoundingClientRect();
      w = Math.max(280, Math.floor(rect.width || 800));
      h = Math.max(360, Math.floor(rect.height || 520));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var starCount = Math.min(110, Math.max(45, Math.floor((w * h) / 7500)));
      stars = [];
      for (var i = 0; i < starCount; i++) {
        var r = i % 9 === 0 ? 2.2 : (i % 3 === 0 ? 1.5 : 1.0);
        var tint = i % 5 === 0 ? "rgba(125,211,252," : (i % 7 === 0 ? "rgba(233,213,255," : "rgba(248,250,252,");
        stars.push({
          x: ((i * 97) % 1000) / 1000 * w,
          y: ((i * 193 + 37) % 1000) / 1000 * h,
          r: r,
          baseAlpha: 0.35 + ((i * 29) % 60) / 100,
          phase: i * 0.7,
          speed: 0.008 + ((i % 7) * 0.002),
          tint: tint
        });
      }

      asteroids = [
        { x: w * 0.14, y: h * 0.22, vx: 0.14, vy: 0.05, rx: 5, ry: 3, rot: 0.4 },
        { x: w * 0.78, y: h * 0.34, vx: -0.11, vy: 0.06, rx: 4, ry: 2.5, rot: 1.2 },
        { x: w * 0.56, y: h * 0.76, vx: 0.09, vy: -0.04, rx: 6, ry: 3.5, rot: 2.1 }
      ];

      galaxies = [
        { x: w * 0.82, y: h * 0.16, rx: 38, ry: 11, angle: -0.35, color: "rgba(168,85,247,0.16)" },
        { x: w * 0.2, y: h * 0.82, rx: 44, ry: 12, angle: 0.28, color: "rgba(56,189,248,0.14)" }
      ];
    }

    function drawFrame(now) {
      ctx.clearRect(0, 0, w, h);

      galaxies.forEach(function (g) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        var grad = ctx.createRadialGradient(0, 0, 2, 0, 0, g.rx);
        grad.addColorStop(0, g.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, g.rx, g.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      stars.forEach(function (st) {
        var twinkle = reducedMotion ? st.baseAlpha : (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(now * st.speed + st.phase)));
        ctx.fillStyle = st.tint + Math.min(0.95, st.baseAlpha * twinkle).toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      });

      asteroids.forEach(function (a) {
        if (!reducedMotion) {
          a.x += a.vx;
          a.y += a.vy;
          a.rot += 0.004;
          if (a.x < -20) a.x = w + 20;
          if (a.x > w + 20) a.x = -20;
          if (a.y < -20) a.y = h + 20;
          if (a.y > h + 20) a.y = -20;
        }
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        ctx.fillStyle = "rgba(148,163,184,0.52)";
        ctx.strokeStyle = "rgba(203,213,225,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.rx, a.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    }

    resizeAndSeed();
    drawFrame(0);

    var onResize = function () {
      resizeAndSeed();
      if (reducedMotion) drawFrame(0);
    };
    window.addEventListener("resize", onResize);

    state.canvasCleanup = function () {
      window.removeEventListener("resize", onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }

  function renderStageCard(stInfo, btnId, isSecondary) {
    var badge = stInfo.status === "completed"
      ? "已完成・可重新查看"
      : (stInfo.status === "available" ? "目前可進行" : "尚未解鎖");
    var disabledAttr = !stInfo.unlocked ? "disabled aria-disabled=\"true\"" : "";
    return (
      "<div class=\"cosmos-stage-box " + esc(stInfo.status) + "\">" +
      "<div class=\"cosmos-stage-top\"><strong>Stage " + esc(stInfo.code) + "｜" + esc(stInfo.title) + "</strong><span class=\"cosmos-state-chip\">" + esc(badge) + "</span></div>" +
      "<div class=\"cosmos-stage-reason\">" + esc(stInfo.statusText) + "</div>" +
      "<button type=\"button\" class=\"sh-mini-btn" + (isSecondary ? "" : " primary") + "\" id=\"" + esc(btnId) + "\" " + disabledAttr + ">" +
      (stInfo.status === "completed" ? "重新查看 Stage " + esc(stInfo.code) : (stInfo.unlocked ? "進入 Stage " + esc(stInfo.code) : "尚未解鎖")) +
      "</button>" +
      "</div>"
    );
  }

  function renderSelectedInspector(chComp) {
    var lvItem = chComp.levels.find(function (x) { return x.levelId === state.selectedLevelId; }) || chComp.levels[0];
    if (!lvItem) return "";

    var pendingTasks = [];
    if (!lvItem.s1.completed) pendingTasks.push(lvItem.s1.statusText);
    if (!lvItem.s2.completed) pendingTasks.push(lvItem.s2.statusText);
    if (!pendingTasks.length) {
      pendingTasks.push("本 Level 的 Stage " + lvItem.levelNumber + "-1 與 Stage " + lvItem.levelNumber + "-2 皆已完成，可隨時重新查看或進入下一關卡。");
    }

    return (
      "<div class=\"cosmos-inspector\">" +
      "<div class=\"cosmos-inspector-head\">" +
      "<div><strong>Level " + lvItem.levelNumber + "：" + esc(lvItem.title) + "</strong> <span class=\"cosmos-star-pill\">" + esc(lvItem.starLabel) + "</span></div>" +
      "<span class=\"sh-tag\">" + (lvItem.levelCompleted ? "本 Level 已完成" : "進行中") + "</span>" +
      "</div>" +
      "<div class=\"cosmos-stage-pair\">" +
      renderStageCard(lvItem.s1, "sh-enter-s1", false) +
      renderStageCard(lvItem.s2, "sh-enter-s2", true) +
      "</div>" +
      "<div class=\"cosmos-pending-box\"><strong>關卡解鎖與待完成說明：</strong><ul>" +
      pendingTasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      "</ul></div>" +
      "</div>"
    );
  }

  function renderStudentHome(target) {
    if (!target) return;
    var eng = window.TeachingEngineModule;
    var sid = getStudentName();
    var stamObj = getStaminaData(sid);
    var stamina = stamObj.data.stamina;
    var stardust = stamObj.data.stardust;

    var chapters = (eng && eng.chapters) || getFallbackChapters();
    var cid = state.activeChapterId;
    var ch = chapters[cid] || chapters["CH-2"];
    var chComp = buildChapterCompletion(sid, ch);

    if (!chComp.levels.some(function (x) { return x.levelId === state.selectedLevelId; }) && chComp.levels[0]) {
      state.selectedLevelId = chComp.levels[0].levelId;
    }

    var totalLevels = chComp.totalCount || 1;
    var explorePct = Math.round((chComp.completedCount / totalLevels) * 100);

    var chTabsHtml = Object.keys(chapters).map(function (k) {
      var item = chapters[k];
      return (
        "<button type=\"button\" class=\"cosmos-ch-tab" + (k === ch.chapterId ? " active" : "") + "\" data-cosmos-ch=\"" + esc(k) + "\">" +
        "Chapter " + item.chapterNumber + "：" + esc(item.title) +
        "</button>"
      );
    }).join("");

    var planetsHtml = chComp.levels.map(function (lv, idx) {
      var isSel = lv.levelId === state.selectedLevelId;
      var anyUnlocked = lv.s1.unlocked || lv.s2.unlocked;
      return (
        "<button type=\"button\" class=\"cosmos-planet-card" + (isSel ? " selected" : "") + (!anyUnlocked ? " locked-orbit" : "") + "\" data-select-lv=\"" + esc(lv.levelId) + "\">" +
        renderPlanetArtwork(lv.planetStyle, false, idx) +
        "<div class=\"cosmos-planet-title\">Level " + lv.levelNumber + "：" + esc(lv.title) + "</div>" +
        "<div class=\"cosmos-star-pill\">" + esc(lv.starLabel) + "</div>" +
        "<div class=\"cosmos-planet-meta\">Stage " + lv.levelNumber + "-1：" + (lv.s1.completed ? "已完成" : (lv.s1.unlocked ? "可進行" : "未解鎖")) + "</div>" +
        "<div class=\"cosmos-planet-meta\">Stage " + lv.levelNumber + "-2：" + (lv.s2.completed ? "已完成" : (lv.s2.unlocked ? "可進行" : "未解鎖")) + "</div>" +
        "</button>"
      );
    }).join("");

    var finalStatusText = chComp.allCompleted
      ? "已解鎖（本章所有 Stage 皆已完成）"
      : "尚未解鎖（需完成本章全部 Level 的 Stage X-1 與 Stage X-2）";

    var finalCardHtml =
      "<div class=\"cosmos-final-star" + (chComp.allCompleted ? " unlocked" : " locked") + "\">" +
      renderPlanetArtwork("", true, 99) +
      "<div>" +
      "<div class=\"cosmos-planet-title\">Chapter " + ch.chapterNumber + " 最終評量與單元總結</div>" +
      "<div class=\"cosmos-planet-meta\">" + esc(finalStatusText) + "</div>" +
      "</div>" +
      "<button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-open-final\" " + (!chComp.allCompleted ? "disabled style=\"opacity:0.45;\"" : "") + ">開啟單元總結</button>" +
      "</div>";

    var statusBarHtml =
      "<div class=\"cosmos-status-strip\" style=\"display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;background:rgba(17,28,53,0.9);border:1px solid rgba(148,163,184,0.3);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;\">" +
      "<div><strong>⚡ 體力：</strong>" + stamina + " / " + MAX_STAMINA + " <strong>✦ 星塵：</strong>" + stardust + " <strong>🧭 本章探索度：</strong>" + explorePct + "%（" + chComp.completedCount + "/" + totalLevels + " 星球）</div>" +
      "<button type=\"button\" class=\"sh-mini-btn\" id=\"sh-refill-stamina\">補充體力（+1）</button>" +
      "</div>";

    var quickQuizHtml =
      "<div class=\"cosmos-quick-quiz\" style=\"background:rgba(17,28,53,0.88);border:1px solid rgba(148,163,184,0.3);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:13px;\">" +
      "<div style=\"font-weight:700;color:#38BDF8;margin-bottom:6px;\">🛰️ 航行快問快答（答對可獲 +15 星塵）</div>" +
      "<div style=\"margin-bottom:8px;color:#E2E8F0;\">若點 A(0, 0) 與點 B(3, 4) 在平面上，兩點距離是多少？（填整數）</div>" +
      "<div style=\"display:flex;gap:8px;flex-wrap:wrap;align-items:center;\">" +
      "<input type=\"text\" id=\"sh-qq-inp\" value=\"" + esc(state.quickQuizAnswer) + "\" placeholder=\"輸入整數答案\" style=\"width:150px;margin:0;padding:6px 10px;background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:8px;\" />" +
      "<button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-qq-sub\">送出快問快答</button>" +
      "</div>" +
      (state.quickQuizFeedback ? "<div style=\"margin-top:8px;color:#5EEAD4;font-weight:700;\">" + esc(state.quickQuizFeedback) + "</div>" : "") +
      "</div>";

    var drawerHtml = "";
    if (state.infoDrawer === "profile") {
      drawerHtml = "<div class=\"sh-drawer\"><div class=\"sh-drawer-head\"><span>學員資料</span><button type=\"button\" class=\"sh-mini-btn\" id=\"sh-close-info\">關閉</button></div><div>學員名稱：<strong>" + esc(sid) + "</strong>｜體力：" + stamina + "/" + MAX_STAMINA + "｜星塵：" + stardust + "｜各 Stage 皆有獨立完成紀錄與嚴格解鎖順序。</div></div>";
    } else if (state.infoDrawer === "guide") {
      drawerHtml = "<div class=\"sh-drawer\"><div class=\"sh-drawer-head\"><span>Stage 解鎖與星級規則</span><button type=\"button\" class=\"sh-mini-btn\" id=\"sh-close-info\">關閉</button></div><div>Stage 1-1 初始開放；完成 Stage X-1 才解鎖 Stage X-2；完成 Stage X-2 才解鎖 Stage (X+1)-1。全部 Level 完成後解鎖 Chapter 最終評量。單純瀏覽或點擊按鈕不會直接判定完成。</div></div>";
    }

    target.innerHTML =
      "<section class=\"space-home-root " + esc(ch.galaxyStyle || "nebula-default") + "\" aria-label=\"宇宙探索地圖\">" +
      "<canvas class=\"cosmos-star-canvas\" aria-hidden=\"true\"></canvas>" +
      "<div class=\"nebula-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"starfield-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"space-content\">" +
      "<div class=\"sh-topbar\">" +
      "<div class=\"sh-brand\">" +
      "<div class=\"sh-logo-mark\" aria-hidden=\"true\">✦</div>" +
      "<div><h1 class=\"sh-title\">星航智學・宇宙學習地圖</h1>" +
      "<p class=\"sh-subtitle\">學員：" + esc(sid) + "｜108課綱 Chapter 1 數與式、Chapter 2 直線與圓、Chapter 3 多項式</p></div>" +
      "</div>" +
      "<div class=\"sh-top-actions\">" +
      "<button type=\"button\" class=\"sh-icon-btn\" data-info-panel=\"profile\">學員狀態</button>" +
      "<button type=\"button\" class=\"sh-icon-btn\" data-info-panel=\"guide\">解鎖規則</button>" +
      "</div>" +
      "</div>" +
      statusBarHtml +
      drawerHtml +
      "<div class=\"sh-panel\">" +
      "<div class=\"sh-section-label\">選擇星系章節（Chapter）與行星關卡（Level）</div>" +
      "<div class=\"cosmos-ch-tabs\">" + chTabsHtml + "</div>" +
      "<div class=\"cosmos-orbit-track\">" + planetsHtml + "</div>" +
      finalCardHtml +
      quickQuizHtml +
      renderSelectedInspector(chComp) +
      "</div>" +
      "</div>" +
      "</section>";

    initCosmosCanvas(target);

    var refillBtn = document.getElementById("sh-refill-stamina");
    if (refillBtn) {
      refillBtn.addEventListener("click", function () {
        var curS = getStaminaData(getStudentName()).data;
        saveStaminaData(getStudentName(), { stamina: curS.stamina + 1, stardust: curS.stardust });
        renderStudentHome(target);
      });
    }

    var qqSub = document.getElementById("sh-qq-sub");
    var qqInp = document.getElementById("sh-qq-inp");
    if (qqSub && qqInp) {
      qqSub.addEventListener("click", function () {
        var ans = qqInp.value.trim();
        state.quickQuizAnswer = ans;
        var curS = getStaminaData(getStudentName()).data;
        if (ans === "5") {
          saveStaminaData(getStudentName(), { stamina: curS.stamina, stardust: curS.stardust + 15 });
          state.quickQuizFeedback = "答對了！sqrt(3^2 + 4^2) = 5，獲得 +15 星塵！";
        } else {
          state.quickQuizFeedback = "再想想看：3^2 + 4^2 = 9 + 16 = 25，開根號後是多少？（提示：5）";
        }
        renderStudentHome(target);
      });
    }

    target.querySelectorAll("[data-cosmos-ch]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.activeChapterId = btn.getAttribute("data-cosmos-ch");
        renderStudentHome(target);
      });
    });

    target.querySelectorAll("[data-select-lv]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.selectedLevelId = btn.getAttribute("data-select-lv");
        renderStudentHome(target);
      });
    });

    target.querySelectorAll("[data-info-panel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pk = btn.getAttribute("data-info-panel");
        state.infoDrawer = state.infoDrawer === pk ? null : pk;
        renderStudentHome(target);
      });
    });

    var closeInfo = document.getElementById("sh-close-info");
    if (closeInfo) closeInfo.addEventListener("click", function () {
      state.infoDrawer = null;
      renderStudentHome(target);
    });

    var bS1 = document.getElementById("sh-enter-s1");
    if (bS1) {
      bS1.addEventListener("click", function () {
        var sidNow = getStudentName();
        var lvId = state.selectedLevelId || "CH2-L1";
        var curS = getStaminaData(sidNow).data;
        if (curS.stamina > 0) {
          saveStaminaData(sidNow, { stamina: curS.stamina - 1, stardust: curS.stardust + 5 });
        }
        if (eng && eng.repository && typeof eng.repository.getSession === "function") {
          var ses1 = eng.repository.getSession(sidNow, lvId);
          ses1.stageCode = "X-1";
          if (!ses1.subStep || ses1.subStep > 3) ses1.subStep = 1;
          if (typeof eng.repository.saveAndSyncMastery === "function") {
            eng.repository.saveAndSyncMastery(ses1);
          }
        }
        if (typeof window.__openTeachingEngineForNode === "function") {
          window.__openTeachingEngineForNode(lvId, "X-1");
        }
      });
    }

    var bS2 = document.getElementById("sh-enter-s2");
    if (bS2) {
      bS2.addEventListener("click", function () {
        var sidNow = getStudentName();
        var lvId = state.selectedLevelId || "CH2-L1";
        if (eng && typeof eng.getStrictStageAccess === "function") {
          var acc = eng.getStrictStageAccess(sidNow, lvId, "X-2");
          if (acc && !acc.allowed) return;
        }
        if (eng && eng.repository && typeof eng.repository.getSession === "function") {
          var ses2 = eng.repository.getSession(sidNow, lvId);
          ses2.stageCode = "X-2";
          if (!ses2.subStep || ses2.subStep < 4) ses2.subStep = 4;
          if (typeof eng.repository.saveAndSyncMastery === "function") {
            eng.repository.saveAndSyncMastery(ses2);
          }
        }
        if (typeof window.__openTeachingEngineForNode === "function") {
          window.__openTeachingEngineForNode(lvId, "X-2");
        }
      });
    }

    var bFinal = document.getElementById("sh-open-final");
    if (bFinal && chComp && chComp.allCompleted) {
      bFinal.addEventListener("click", function () {
        var lastLv = chComp.levels[chComp.levels.length - 1];
        if (!lastLv) return;
        if (typeof window.__openTeachingEngineForNode === "function") {
          window.__openTeachingEngineForNode(lastLv.levelId, "X-2");
        }
      });
    }
  }

  window.StudentHomeModule = { render: renderStudentHome };
})();

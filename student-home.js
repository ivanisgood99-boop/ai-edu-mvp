/* 學生端宇宙探索地圖：Chapter 1 數與式、Chapter 2 直線與圓、Chapter 3 多項式 */
(function () {
  "use strict";

  var state = {
    activeChapterId: "CH-2",
    selectedLevelId: "CH2-L2",
    infoDrawer: null
  };

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPlanetArtwork(styleName, isFinal) {
    if (isFinal) {
      return (
        "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 80 80\" width=\"72\" height=\"72\" aria-hidden=\"true\">" +
        "<defs><radialGradient id=\"gFinal\" cx=\"35%\" cy=\"30%\"><stop offset=\"0%\" stop-color=\"#5EEAD4\"/><stop offset=\"65%\" stop-color=\"#0284C7\"/><stop offset=\"100%\" stop-color=\"#0F172A\"/></radialGradient></defs>" +
        "<circle cx=\"40\" cy=\"40\" r=\"20\" fill=\"url(#gFinal)\"/>" +
        "<ellipse cx=\"40\" cy=\"40\" rx=\"36\" ry=\"11\" fill=\"none\" stroke=\"#38BDF8\" stroke-width=\"2\" transform=\"rotate(-18 40 40)\"/>" +
        "<circle cx=\"40\" cy=\"40\" r=\"27\" fill=\"none\" stroke=\"#C084FC\" stroke-width=\"1.4\" stroke-dasharray=\"4 3\"/>" +
        "</svg>"
      );
    }
    if (styleName === "planet-ring-cyan") {
      return (
        "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 80 80\" width=\"68\" height=\"68\" aria-hidden=\"true\">" +
        "<defs><radialGradient id=\"gRing\" cx=\"32%\" cy=\"28%\"><stop offset=\"0%\" stop-color=\"#7DD3FC\"/><stop offset=\"70%\" stop-color=\"#1D4ED8\"/><stop offset=\"100%\" stop-color=\"#090D16\"/></radialGradient></defs>" +
        "<circle cx=\"40\" cy=\"40\" r=\"20\" fill=\"url(#gRing)\"/>" +
        "<path d=\"M16 36 Q40 28 64 38\" fill=\"none\" stroke=\"#2DD4BF\" stroke-width=\"2\"/>" +
        "<ellipse cx=\"40\" cy=\"42\" rx=\"34\" ry=\"9\" fill=\"none\" stroke=\"#38BDF8\" stroke-width=\"2\" transform=\"rotate(12 40 42)\"/>" +
        "</svg>"
      );
    }
    if (styleName === "planet-ring-violet") {
      return (
        "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 80 80\" width=\"68\" height=\"68\" aria-hidden=\"true\">" +
        "<defs><radialGradient id=\"gViol\" cx=\"32%\" cy=\"28%\"><stop offset=\"0%\" stop-color=\"#E9D5FF\"/><stop offset=\"68%\" stop-color=\"#7E22CE\"/><stop offset=\"100%\" stop-color=\"#0B1228\"/></radialGradient></defs>" +
        "<circle cx=\"40\" cy=\"40\" r=\"20\" fill=\"url(#gViol)\"/>" +
        "<circle cx=\"64\" cy=\"22\" r=\"5\" fill=\"#38BDF8\" opacity=\"0.85\"/>" +
        "<path d=\"M8 40 Q40 12 72 40\" fill=\"none\" stroke=\"rgba(192,132,252,0.45)\" stroke-width=\"1.3\" stroke-dasharray=\"3 3\"/>" +
        "</svg>"
      );
    }
    return (
      "<svg class=\"cosmos-planet-art\" viewBox=\"0 0 80 80\" width=\"68\" height=\"68\" aria-hidden=\"true\">" +
      "<defs><radialGradient id=\"gCrat\" cx=\"30%\" cy=\"28%\"><stop offset=\"0%\" stop-color=\"#FDE68A\"/><stop offset=\"62%\" stop-color=\"#0284C7\"/><stop offset=\"100%\" stop-color=\"#0B1228\"/></radialGradient></defs>" +
      "<circle cx=\"40\" cy=\"40\" r=\"20\" fill=\"url(#gCrat)\"/>" +
      "<circle cx=\"31\" cy=\"32\" r=\"4.5\" fill=\"rgba(15,23,42,0.32)\"/>" +
      "<circle cx=\"47\" cy=\"46\" r=\"3.5\" fill=\"rgba(15,23,42,0.28)\"/>" +
      "</svg>"
    );
  }

  function getStudentName() {
    var el = document.getElementById("stuInp");
    var v = el && el.value ? el.value.trim() : "";
    var ls = (localStorage.getItem("edu_stu") || "").trim();
    return v || ls || "訪客學員";
  }

  function renderSelectedInspector(chComp) {
    var lvItem = chComp.levels.find(function (x) { return x.levelId === state.selectedLevelId; }) || chComp.levels[0];
    if (!lvItem) return "";

    var pendingTasks = [];
    if (!lvItem.stage1Completed) {
      pendingTasks.push("完成 Stage " + lvItem.levelNumber + "-1 觀念學習（教材學習、引導問題、理解檢查）");
    }
    if (!lvItem.stage2Completed) {
      pendingTasks.push("完成 Stage " + lvItem.levelNumber + "-2 刷題練習（互動練習、個人化加強、學習總結）");
    }
    if (lvItem.missingReasons && lvItem.missingReasons.length) {
      pendingTasks = pendingTasks.concat(lvItem.missingReasons);
    }
    if (!pendingTasks.length) {
      pendingTasks.push("本 Level 雙 Stage 皆已完成，可再次練習或探索下一顆星球");
    }

    return (
      "<div class=\"cosmos-inspector\">" +
      "<div class=\"cosmos-inspector-head\">" +
      "<div><strong>Level " + lvItem.levelNumber + "：" + esc(lvItem.title) + "</strong> <span class=\"cosmos-star-pill\">" + esc(lvItem.starLabel) + "</span></div>" +
      "<span class=\"sh-tag\">" + (lvItem.levelCompleted ? "已完成" : "進行中") + "</span>" +
      "</div>" +
      "<div class=\"cosmos-stage-pair\">" +
      "<div class=\"cosmos-stage-box\"><strong>Stage " + lvItem.levelNumber + "-1 觀念學習</strong><div>狀態：" + (lvItem.stage1Completed ? "已完成" : "尚未完成") + "</div></div>" +
      "<div class=\"cosmos-stage-box\"><strong>Stage " + lvItem.levelNumber + "-2 刷題練習</strong><div>狀態：" + (lvItem.stage2Completed ? "已完成" : (lvItem.stage2Unlocked ? "已解鎖・待完成" : "完成 X-1 後解鎖")) + "</div></div>" +
      "</div>" +
      "<div class=\"cosmos-pending-box\"><strong>尚未完成／待補齊項目：</strong><ul>" +
      pendingTasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      "</ul></div>" +
      "<div class=\"sh-actions\">" +
      "<button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-enter-s1\">進入 Stage " + lvItem.levelNumber + "-1 觀念學習</button>" +
      "<button type=\"button\" class=\"sh-mini-btn\" id=\"sh-enter-s2\" " + (!lvItem.stage2Unlocked ? "disabled style=\"opacity:0.45;\"" : "") + ">進入 Stage " + lvItem.levelNumber + "-2 刷題練習</button>" +
      "</div>" +
      "</div>"
    );
  }

  function renderStudentHome(target) {
    if (!target) return;
    var eng = window.TeachingEngineModule;
    var sid = getStudentName();
    var chapters = (eng && eng.chapters) || {};
    var cid = state.activeChapterId;
    var ch = chapters[cid] || chapters["CH-2"];
    var chComp = (eng && eng.getChapterCompletion)
      ? eng.getChapterCompletion(sid, ch.chapterId)
      : { completedCount: 0, totalCount: 0, allCompleted: false, levels: [] };

    if (!chComp.levels.some(function (x) { return x.levelId === state.selectedLevelId; }) && chComp.levels[0]) {
      state.selectedLevelId = chComp.levels[0].levelId;
    }

    var chTabsHtml = Object.keys(chapters).map(function (k) {
      var item = chapters[k];
      return (
        "<button type=\"button\" class=\"cosmos-ch-tab" + (k === ch.chapterId ? " active" : "") + "\" data-cosmos-ch=\"" + esc(k) + "\">" +
        "Chapter " + item.chapterNumber + "：" + esc(item.title) +
        "</button>"
      );
    }).join("");

    var planetsHtml = chComp.levels.map(function (lv) {
      var isSel = lv.levelId === state.selectedLevelId;
      return (
        "<button type=\"button\" class=\"cosmos-planet-card" + (isSel ? " selected" : "") + "\" data-select-lv=\"" + esc(lv.levelId) + "\">" +
        renderPlanetArtwork(lv.planetStyle, false) +
        "<div class=\"cosmos-planet-title\">Level " + lv.levelNumber + "：" + esc(lv.title) + "</div>" +
        "<div class=\"cosmos-star-pill\">" + esc(lv.starLabel) + "</div>" +
        "<div class=\"cosmos-planet-meta\">X-1 " + (lv.stage1Completed ? "完成" : "未完") + " · X-2 " + (lv.stage2Completed ? "完成" : "未完") + "</div>" +
        "</button>"
      );
    }).join("");

    var finalStatusText = chComp.allCompleted
      ? "已解鎖（全 Level 完成）"
      : "尚未解鎖（需完成本章全部 " + chComp.totalCount + " 個 Level）";

    var finalCardHtml =
      "<div class=\"cosmos-final-star" + (chComp.allCompleted ? " unlocked" : " locked") + "\">" +
      renderPlanetArtwork("", true) +
      "<div>" +
      "<div class=\"cosmos-planet-title\">Chapter " + ch.chapterNumber + " 最終評量與單元總結</div>" +
      "<div class=\"cosmos-planet-meta\">" + esc(finalStatusText) + "</div>" +
      "</div>" +
      "<button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-open-final\" " + (!chComp.allCompleted ? "disabled style=\"opacity:0.45;\"" : "") + ">開啟單元總結</button>" +
      "</div>";

    var drawerHtml = "";
    if (state.infoDrawer === "profile") {
      drawerHtml = "<div class=\"sh-drawer\"><div class=\"sh-drawer-head\"><span>學員資料</span><button type=\"button\" class=\"sh-mini-btn\" id=\"sh-close-info\">關閉</button></div><div>學員名稱：<strong>" + esc(sid) + "</strong>｜星級精熟度依各 Level 作答與加強紀錄獨立評估。</div></div>";
    } else if (state.infoDrawer === "guide") {
      drawerHtml = "<div class=\"sh-drawer\"><div class=\"sh-drawer-head\"><span>星級與關卡說明</span><button type=\"button\" class=\"sh-mini-btn\" id=\"sh-close-info\">關閉</button></div><div>每個 Level 皆有 Stage X-1（觀念學習）與 Stage X-2（刷題練習）。兩個 Stage 都完成後該 Level 才算完成；全部 Level 完成後解鎖 Chapter 最終評量。資料不足顯示「尚未評定」，單次錯誤不會立即降星。</div></div>";
    }

    target.innerHTML =
      "<section class=\"space-home-root " + esc(ch.galaxyStyle) + "\" aria-label=\"宇宙探索地圖\">" +
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
      "<button type=\"button\" class=\"sh-icon-btn\" data-info-panel=\"guide\">星級規則</button>" +
      "</div>" +
      "</div>" +
      drawerHtml +
      "<div class=\"sh-panel\">" +
      "<div class=\"sh-section-label\">選擇星系章節（Chapter）</div>" +
      "<div class=\"cosmos-ch-tabs\">" + chTabsHtml + "</div>" +
      "<div class=\"cosmos-orbit-track\">" + planetsHtml + "</div>" +
      finalCardHtml +
      renderSelectedInspector(chComp) +
      "</div>" +
      "</div>" +
      "</section>";

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
    if (bS1) bS1.addEventListener("click", function () {
      var ses = eng.repository.getSession(getStudentName(), state.selectedLevelId);
      ses.stageCode = "X-1";
      ses.subStep = 1;
      eng.repository.saveAndSyncMastery(ses);
      if (typeof window.__openTeachingEngineForNode === "function") {
        window.__openTeachingEngineForNode(state.selectedLevelId, "X-1");
      }
    });

    var bS2 = document.getElementById("sh-enter-s2");
    if (bS2) bS2.addEventListener("click", function () {
      var ses = eng.repository.getSession(getStudentName(), state.selectedLevelId);
      if (!ses.stage2Unlocked) return;
      ses.stageCode = "X-2";
      ses.subStep = 4;
      eng.repository.saveAndSyncMastery(ses);
      if (typeof window.__openTeachingEngineForNode === "function") {
        window.__openTeachingEngineForNode(state.selectedLevelId, "X-2");
      }
    });

    var bFinal = document.getElementById("sh-open-final");
    if (bFinal && chComp.allCompleted) bFinal.addEventListener("click", function () {
      var lastLv = chComp.levels[chComp.levels.length - 1];
      if (!lastLv) return;
      var ses = eng.repository.getSession(getStudentName(), lastLv.levelId);
      ses.stageCode = "X-2";
      ses.subStep = 6;
      eng.repository.saveAndSyncMastery(ses);
      if (typeof window.__openTeachingEngineForNode === "function") {
        window.__openTeachingEngineForNode(lastLv.levelId, "X-2");
      }
    });
  }

  window.StudentHomeModule = { render: renderStudentHome };
})();

/* 學生端首頁 - 邏輯與展示資料層（獨立檔案） */
(function () {
  "use strict";

  var DEMO_STUDENT_HOME_DATA = {
    isDemoSnapshot: true,
    profile: {
      name: localStorage.getItem("edu_stu") || "星航學員",
      roleTitle: "宇宙探索見習生",
      classCode: localStorage.getItem("edu_code") || "MATH2026",
      focusNote: "穩紮穩打建立指數與對數觀念"
    },
    status: {
      progressPercent: 40,
      progressLabel: "M1 基礎航段 40%（示範）",
      energyCurrent: 100,
      energyMax: 100,
      rocketSupply: 3,
      learningPoints: 240
    },
    today: {
      goal: "完成 1 個指數微技能核心題與變化題，並說出解題理由（示範）",
      recentUnit: "M1-01 正整數指數（示範）",
      pendingTasks: [
        { id: "task-1", title: "完成 M1-01 正整數指數六階段練習", tag: "可練習" },
        { id: "task-2", title: "探索 M1-02 零指數六階段練習", tag: "可練習" }
      ]
    },
    achievements: {
      streakDays: 4,
      completedUnits: 1,
      badgesCount: 2,
      latestBadge: "觀念釐清徽章（示範）"
    },
    topicModes: [
      { id: "M1-01", available: true, title: "M1-01 正整數指數", desc: "從連乘意義、負數次方與括號辨識進入六階段教學引擎" },
      { id: "M1-02", available: true, title: "M1-02 零指數", desc: "從非零底數零次方、底數限制與除法規律進入六階段教學引擎" },
      { id: "M2-01", available: false, title: "M2-01 負整數與分數指數", desc: "尚未開放完整教材與題庫" }
    ],
    schoolCourses: [
      { id: "M1-01", available: true, title: "高中數學・M1-01 正整數指數", desc: "對應目前可練習單元，進入新教學引擎" },
      { id: "M1-02", available: true, title: "高中數學・M1-02 零指數", desc: "對應目前可練習單元，進入新教學引擎" },
      { id: "M3-01", available: false, title: "高中數學・指數函數與圖形", desc: "尚未開放完整教材與題庫" }
    ],
    explanations: {
      energy: "【示範說明】能量（100/100）為首頁展示數值，尚未與真實作答或點數系統連動。",
      rocket: "【示範說明】火箭補給（3 枚）為首頁展示數值，目前僅提供說明展示，無扣點或交易功能。"
    }
  };

  var StudentHomeDataProvider = {
    getHomeSnapshot: function () {
      var storedName = localStorage.getItem("edu_stu");
      var storedCode = localStorage.getItem("edu_code");
      var base = JSON.parse(JSON.stringify(DEMO_STUDENT_HOME_DATA));
      if (storedName && storedName.trim()) base.profile.name = storedName.trim();
      if (storedCode && storedCode.trim()) base.profile.classCode = storedCode.trim();
      return base;
    }
  };

  var homeState = { activePanel: null, compactMode: false };

  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderStarsHtml() {
    var coords = [
      [8, 12, 2], [22, 26, 3], [38, 10, 2], [54, 22, 2], [68, 14, 3],
      [84, 34, 2], [14, 52, 2], [30, 68, 3], [48, 48, 2], [72, 62, 2],
      [88, 74, 3], [60, 82, 2], [25, 88, 2], [78, 88, 2]
    ];
    return coords.map(function (c, idx) {
      return "<span class=\"space-star\" style=\"left:" + c[0] + "%;top:" + c[1] + "%;width:" + c[2] + "px;height:" + c[2] + "px;animation-delay:" + ((idx % 5) * 0.6) + "s;\"></span>";
    }).join("");
  }

  function renderCourseList(items, modeLabel) {
    return items.map(function (item) {
      if (!item.available) {
        return "<div style=\"padding:10px;border-radius:10px;background:rgba(15,23,42,0.55);border:1px dashed rgba(148,163,184,0.3);margin-bottom:8px;opacity:0.75;\"><strong>" + esc(item.title) + "</strong> <span class=\"sh-tag\">尚未開放</span><div style=\"color:#94a3b8;font-size:12px;margin-top:4px;\">" + esc(item.desc) + "</div></div>";
      }
      return "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);margin-bottom:8px;\"><strong>" + esc(item.title) + "</strong><div style=\"color:#94a3b8;font-size:12px;margin:2px 0 6px;\">" + esc(item.desc) + "</div><button type=\"button\" class=\"sh-mini-btn primary\" data-launch-node=\"" + esc(item.id) + "\" data-launch-mode=\"" + esc(modeLabel) + "\">啟動 " + esc(item.id) + " 教學引擎</button></div>";
    }).join("");
  }
  function renderActiveDrawer(data) {
    if (!homeState.activePanel) return "";
    var title = "", bodyHtml = "";

    if (homeState.activePanel === "topic") {
      title = "主題學習模式選擇";
      bodyHtml = "<p style=\"margin:0 0 10px;color:#cbd5e1;\">請選擇要進入六階段教學引擎的個別知識主題：</p>" + renderCourseList(data.topicModes, "topic");
    } else if (homeState.activePanel === "school") {
      title = "學校課程選擇";
      bodyHtml = "<p style=\"margin:0 0 10px;color:#cbd5e1;\">請選擇學校課程單元（班級碼：" + esc(data.profile.classCode) + "）：</p>" + renderCourseList(data.schoolCourses, "school");
    } else if (homeState.activePanel === "profile") {
      title = "學生個人資料（本機原型）";
      bodyHtml = "<div style=\"line-height:1.7;\"><div>學員名稱：<strong>" + esc(data.profile.name) + "</strong></div><div>探索稱號：" + esc(data.profile.roleTitle) + "</div><div>目前班級碼：" + esc(data.profile.classCode) + "</div><div style=\"margin-top:8px;\"><button type=\"button\" class=\"sh-mini-btn\" data-launch-node=\"M1-01\" data-launch-mode=\"topic\">前往設定姓名與學習引擎</button></div></div>";
    } else if (homeState.activePanel === "settings") {
      title = "首頁顯示設定";
      bodyHtml = "<label style=\"display:flex;align-items:center;gap:8px;cursor:pointer;\"><input id=\"sh-toggle-compact\" type=\"checkbox\" " + (homeState.compactMode ? "checked" : "") + " /><span>精簡卡片間距（適合小螢幕手機）</span></label>";
    } else if (homeState.activePanel === "energy") {
      title = "能量說明（示範資料）";
      bodyHtml = "<p style=\"margin:0;color:#e2e8f0;\">" + esc(data.explanations.energy) + "</p>";
    } else if (homeState.activePanel === "rocket") {
      title = "火箭補給說明（示範資料）";
      bodyHtml = "<p style=\"margin:0;color:#e2e8f0;\">" + esc(data.explanations.rocket) + "</p>";
    }

    return "<div class=\"sh-drawer\" role=\"region\" aria-label=\"" + esc(title) + "\"><div class=\"sh-drawer-head\"><span>" + esc(title) + "</span><button type=\"button\" class=\"sh-mini-btn\" id=\"sh-close-drawer\">關閉</button></div>" + bodyHtml + "</div>";
  }

  function renderStudentHome(targetContainer) {
    if (!targetContainer) return;
    var data = StudentHomeDataProvider.getHomeSnapshot();
    var padStyle = homeState.compactMode ? "padding:12px 12px 20px;" : "";

    targetContainer.innerHTML =
      "<section class=\"space-home-root\" style=\"" + padStyle + "\" aria-label=\"學生端太空探索首頁\">" +
      "<div class=\"space-sky-layer\">" + renderStarsHtml() + "<span class=\"space-meteor\"></span><span class=\"space-meteor delay-1\"></span></div>" +
      "<span class=\"space-planet space-planet-ringed\"></span><span class=\"space-planet space-planet-orb\"></span>" +
      "<div class=\"space-content\">" +
      "<div class=\"sh-topbar\"><div class=\"sh-brand\"><div class=\"sh-logo-mark\" aria-hidden=\"true\">✦</div><div><h1 class=\"sh-title\">星航智學・AI 教育平台</h1><p class=\"sh-subtitle\">歡迎回來，" + esc(data.profile.name) + "｜狀態與成就為示範資料</p></div></div>" +
      "<div class=\"sh-top-actions\"><button type=\"button\" class=\"sh-icon-btn\" data-sh-panel=\"profile\">個人資料</button><button type=\"button\" class=\"sh-icon-btn\" data-sh-panel=\"settings\">設定</button></div></div>" +
      "<div class=\"sh-panel\"><div class=\"sh-section-label\">航行與學習狀態（示範資料）</div><div class=\"sh-status-grid\">" +
      "<div class=\"sh-stat-card\"><div class=\"sh-stat-title\">目前學習進度（示範）</div><div class=\"sh-stat-val\">" + esc(data.status.progressLabel) + "</div><div class=\"sh-progress-track\"><div class=\"sh-progress-fill\" style=\"width:" + data.status.progressPercent + "%;\"></div></div></div>" +
      "<button type=\"button\" class=\"sh-stat-card interactive\" data-sh-panel=\"energy\"><div class=\"sh-stat-title\">能量（示範）</div><div class=\"sh-stat-val\">" + data.status.energyCurrent + "/" + data.status.energyMax + "</div><div class=\"sh-stat-hint\">點擊查看示範說明</div></button>" +
      "<button type=\"button\" class=\"sh-stat-card interactive\" data-sh-panel=\"rocket\"><div class=\"sh-stat-title\">火箭補給庫存（示範）</div><div class=\"sh-stat-val\">" + data.status.rocketSupply + " 枚</div><div class=\"sh-stat-hint\">點擊查看示範說明</div></button>" +
      "<div class=\"sh-stat-card\"><div class=\"sh-stat-title\">學習點數（示範）</div><div class=\"sh-stat-val\">" + data.status.learningPoints + " 點</div><div class=\"sh-stat-hint\" style=\"color:#34d399;\">原型示範數值</div></div>" +
      "</div></div>" +
      "<div class=\"sh-panel\"><div class=\"sh-section-label\">選擇航道・主要學習入口</div><div class=\"sh-entry-grid\">" +
      "<button type=\"button\" class=\"sh-entry-card sh-entry-topic\" data-sh-panel=\"topic\"><span class=\"sh-entry-badge\">主題模式選擇</span><h2 class=\"sh-entry-name\">主題學習</h2><p class=\"sh-entry-desc\">挑選個別知識主題（M1-01、M1-02），進入六階段教學引擎。</p><span class=\"sh-entry-cta\">選擇知識主題 →</span></button>" +
      "<button type=\"button\" class=\"sh-entry-card sh-entry-school\" data-sh-panel=\"school\"><span class=\"sh-entry-badge\">學校課程選擇</span><h2 class=\"sh-entry-name\">學校學習</h2><p class=\"sh-entry-desc\">挑選學校課程單元，進入六階段教學引擎。</p><span class=\"sh-entry-cta\">選擇學校課程 →</span></button>" +
      "</div>" + renderActiveDrawer(data) + "</div>" +
      "<div class=\"sh-two-col\">" +
      "<div class=\"sh-panel\" style=\"margin-bottom:0;\"><div class=\"sh-section-label\">今日學習（示範資料）</div><p style=\"margin:0 0 10px;font-size:13px;font-weight:600;color:#f8fafc;\">今日目標：" + esc(data.today.goal) + "</p><p style=\"margin:0 0 8px;font-size:12px;color:#94a3b8;\">最近學習：" + esc(data.today.recentUnit) + "</p><ul class=\"sh-list\">" +
      data.today.pendingTasks.map(function (t) { return "<li><span>" + esc(t.title) + "</span><span class=\"sh-tag\">" + esc(t.tag) + "</span></li>"; }).join("") +
      "</ul></div>" +
      "<div class=\"sh-panel\" style=\"margin-bottom:0;\"><div class=\"sh-section-label\">成就與進度（示範資料）</div><div class=\"sh-ach-grid\">" +
      "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.streakDays + " 天</div><div class=\"sh-ach-txt\">連續學習（示範）</div></div>" +
      "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.completedUnits + " 項</div><div class=\"sh-ach-txt\">已完成（示範）</div></div>" +
      "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.badgesCount + " 枚</div><div class=\"sh-ach-txt\">成就（示範）</div></div>" +
      "</div><div style=\"font-size:12px;color:#cbd5e1;\">最新成就：<strong>" + esc(data.achievements.latestBadge) + "</strong></div></div>" +
      "</div></div></section>";

    targetContainer.querySelectorAll("[data-sh-panel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var panelKey = btn.getAttribute("data-sh-panel");
        homeState.activePanel = homeState.activePanel === panelKey ? null : panelKey;
        renderStudentHome(targetContainer);
      });
    });

    var closeBtn = document.getElementById("sh-close-drawer");
    if (closeBtn) closeBtn.addEventListener("click", function () { homeState.activePanel = null; renderStudentHome(targetContainer); });

    var compactChk = document.getElementById("sh-toggle-compact");
    if (compactChk) compactChk.addEventListener("change", function (e) { homeState.compactMode = Boolean(e.target.checked); renderStudentHome(targetContainer); });

    targetContainer.querySelectorAll("[data-launch-node]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var nodeId = btn.getAttribute("data-launch-node");
        var modeName = btn.getAttribute("data-launch-mode") || "topic";
        if (typeof window.__openTeachingEngineForNode === "function") window.__openTeachingEngineForNode(nodeId, modeName);
      });
    });
  }

  window.StudentHomeModule = { render: renderStudentHome, dataProvider: StudentHomeDataProvider };
})();

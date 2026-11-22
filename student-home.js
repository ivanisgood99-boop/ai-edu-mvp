/* 學生端首頁 - 邏輯與展示資料層（獨立檔案） */
(function () {
  "use strict";

  // 1. 展示資料（與正式資料存取介面分離，後續替換為真實資料來源即可）
  var DEMO_STUDENT_HOME_DATA = {
    profile: {
      name: localStorage.getItem("edu_stu") || "星航學員",
      roleTitle: "宇宙探索見習生",
      classCode: localStorage.getItem("edu_code") || "MATH2026",
      focusNote: "穩紮穩打建立指數與對數觀念"
    },
    status: {
      progressPercent: 40,
      progressLabel: "M1 基礎航段 40%",
      energyCurrent: 100,
      energyMax: 100,
      rocketSupply: 3,
      learningPoints: 240
    },
    today: {
      goal: "完成 1 個指數微技能核心題與變化題，並說出解題理由",
      recentUnit: "M1-01 正整數指數（連乘與括號辨識）",
      pendingTasks: [
        { id: "task-1", title: "完成 M1-01b 括號與負號辨識變化題", tag: "待完成" },
        { id: "task-2", title: "探索 M1-02a 零指數與底數限制（x ≠ 0）", tag: "建議今日" }
      ]
    },
    achievements: {
      streakDays: 4,
      completedUnits: 1,
      badgesCount: 2,
      latestBadge: "觀念釐清徽章"
    },
    topicModes: [
      { id: "M1-01", title: "正整數指數探索", desc: "從連乘意義與括號辨識建立穩固起點" },
      { id: "M1-02", title: "零指數與條件限制", desc: "理解 a^0 = 1 與底數不為 0 的推理" }
    ],
    schoolCourses: [
      { id: "MATH2026-M1", title: "高中數學・指數與對數（M1 單元）", desc: "搭配班級邀請碼同步學習進度與作答紀錄" }
    ],
    explanations: {
      energy: "能量（100/100）代表目前可投入專注學習的精力狀態；遇到卡關時可善用分層提示逐步釐清觀念，而非急著猜答案。",
      rocket: "火箭補給（目前 3 枚）象徵加速推進或複習衝刺的補給資源；首頁階段先提供狀態說明與導覽展示，不進行扣點或交易。"
    }
  };

  // 2. 正式資料存取介面（預留給未來接軌真實進度/點數資料，不直接混入展示資料常數）
  var StudentHomeDataProvider = {
    getHomeSnapshot: function () {
      var storedName = localStorage.getItem("edu_stu");
      var storedCode = localStorage.getItem("edu_code");
      var masteredRaw = localStorage.getItem("edu_mastered");
      var masteredCount = 0;

      if (masteredRaw) {
        try {
          var parsed = JSON.parse(masteredRaw);
          masteredCount = Object.keys(parsed).filter(function (k) {
            return Boolean(parsed[k]);
          }).length;
        } catch (e) {
          masteredCount = 0;
        }
      }

      var base = JSON.parse(JSON.stringify(DEMO_STUDENT_HOME_DATA));
      if (storedName && storedName.trim()) {
        base.profile.name = storedName.trim();
      }
      if (storedCode && storedCode.trim()) {
        base.profile.classCode = storedCode.trim();
      }
      if (masteredCount > 0) {
        base.achievements.completedUnits = masteredCount;
        base.status.progressPercent = Math.min(100, 25 + masteredCount * 25);
        base.status.progressLabel = "已完成 " + masteredCount + " 個微技能節點";
      }
      return base;
    }
  };

  var homeState = {
    activePanel: null, // null | "topic" | "school" | "profile" | "settings" | "energy" | "rocket"
    soundHintEnabled: true,
    compactMode: false
  };

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function renderActiveDrawer(data) {
    if (!homeState.activePanel) return "";

    var bodyHtml = "";
    var title = "";

    if (homeState.activePanel === "topic") {
      title = "主題學習模式選擇";
      bodyHtml = "<p style=\"margin:0 0 10px;color:#cbd5e1;\">依觀念主題自主探索，適合從零建立概念與反例辨識：</p>" +
        data.topicModes.map(function (m) {
          return "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);margin-bottom:8px;\">" +
            "<strong>" + esc(m.title) + "</strong><div style=\"color:#94a3b8;font-size:12px;margin:2px 0 6px;\">" + esc(m.desc) + "</div>" +
            "<button type=\"button\" class=\"sh-mini-btn primary\" data-launch-legacy=\"student\">進入主題學習工作區</button></div>";
        }).join("");
    } else if (homeState.activePanel === "school") {
      title = "學校課程選擇";
      bodyHtml = "<p style=\"margin:0 0 10px;color:#cbd5e1;\">對齊學校課程與班級邀請碼（目前代碼：<strong>" + esc(data.profile.classCode) + "</strong>）：</p>" +
        data.schoolCourses.map(function (sc) {
          return "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);margin-bottom:8px;\">" +
            "<strong>" + esc(sc.title) + "</strong><div style=\"color:#94a3b8;font-size:12px;margin:2px 0 6px;\">" + esc(sc.desc) + "</div>" +
            "<button type=\"button\" class=\"sh-mini-btn primary\" data-launch-legacy=\"student\">進入學校課程練習</button></div>";
        }).join("");
    } else if (homeState.activePanel === "profile") {
      title = "學生個人資料";
      bodyHtml = "<div style=\"line-height:1.7;\">" +
        "<div>學員名稱：<strong>" + esc(data.profile.name) + "</strong></div>" +
        "<div>探索稱號：" + esc(data.profile.roleTitle) + "</div>" +
        "<div>目前班級碼：" + esc(data.profile.classCode) + "</div>" +
        "<div>學習宣言：" + esc(data.profile.focusNote) + "</div>" +
        "<div style=\"margin-top:8px;\"><button type=\"button\" class=\"sh-mini-btn\" data-launch-legacy=\"student\">前往編輯姓名與班級碼</button></div>" +
        "</div>";
    } else if (homeState.activePanel === "settings") {
      title = "首頁顯示設定";
      bodyHtml = "<div style=\"display:flex;flex-direction:column;gap:8px;\">" +
        "<label style=\"display:flex;align-items:center;gap:8px;cursor:pointer;\">" +
        "<input id=\"sh-toggle-compact\" type=\"checkbox\" " + (homeState.compactMode ? "checked" : "") + " />" +
        "<span>精簡卡片間距（適合小螢幕手機）</span></label>" +
        "<div style=\"color:#94a3b8;font-size:12px;\">此設定僅調整首頁顯示偏好，不影響既有學習紀錄與資料庫。</div>" +
        "</div>";
    } else if (homeState.activePanel === "energy") {
      title = "能量系統說明";
      bodyHtml = "<p style=\"margin:0;color:#e2e8f0;\">" + esc(data.explanations.energy) + "</p>";
    } else if (homeState.activePanel === "rocket") {
      title = "火箭補給說明";
      bodyHtml = "<p style=\"margin:0;color:#e2e8f0;\">" + esc(data.explanations.rocket) + "</p>";
    }

    return "<div class=\"sh-drawer\" role=\"region\" aria-label=\"" + esc(title) + "\">" +
      "<div class=\"sh-drawer-head\"><span>" + esc(title) + "</span>" +
      "<button type=\"button\" class=\"sh-mini-btn\" id=\"sh-close-drawer\">關閉</button></div>" +
      bodyHtml + "</div>";
  }

  function renderStudentHome(targetContainer) {
    if (!targetContainer) return;
    var data = StudentHomeDataProvider.getHomeSnapshot();
    var padStyle = homeState.compactMode ? "padding:12px 12px 20px;" : "";

    targetContainer.innerHTML =
      "<section class=\"space-home-root\" style=\"" + padStyle + "\" aria-label=\"學生端太空探索首頁\">" +
      "<div class=\"space-sky-layer\">" + renderStarsHtml() +
      "<span class=\"space-meteor\"></span><span class=\"space-meteor delay-1\"></span></div>" +
      "<span class=\"space-planet space-planet-ringed\"></span>" +
      "<span class=\"space-planet space-planet-orb\"></span>" +
      "<div class=\"space-content\">" +

      // 1. 頂部區域
      "<div class=\"sh-topbar\">" +
        "<div class=\"sh-brand\">" +
          "<div class=\"sh-logo-mark\" aria-hidden=\"true\">✦</div>" +
          "<div><h1 class=\"sh-title\">星航智學・AI 教育平台</h1>" +
          "<p class=\"sh-subtitle\">歡迎回來，" + esc(data.profile.name) + "｜宇宙探索學習首頁</p></div>" +
        "</div>" +
        "<div class=\"sh-top-actions\">" +
          "<button type=\"button\" class=\"sh-icon-btn\" data-sh-panel=\"profile\">個人資料</button>" +
          "<button type=\"button\" class=\"sh-icon-btn\" data-sh-panel=\"settings\">設定</button>" +
        "</div>" +
      "</div>" +

      // 2. 學習狀態
      "<div class=\"sh-panel\">" +
        "<div class=\"sh-section-label\">航行與學習狀態</div>" +
        "<div class=\"sh-status-grid\">" +
          "<div class=\"sh-stat-card\">" +
            "<div class=\"sh-stat-title\">目前學習進度</div>" +
            "<div class=\"sh-stat-val\">" + esc(data.status.progressLabel) + "</div>" +
            "<div class=\"sh-progress-track\"><div class=\"sh-progress-fill\" style=\"width:" + data.status.progressPercent + "%;\"></div></div>" +
          "</div>" +
          "<button type=\"button\" class=\"sh-stat-card interactive\" data-sh-panel=\"energy\">" +
            "<div class=\"sh-stat-title\">能量</div>" +
            "<div class=\"sh-stat-val\">" + data.status.energyCurrent + "/" + data.status.energyMax + "</div>" +
            "<div class=\"sh-stat-hint\">點擊查看說明</div>" +
          "</button>" +
          "<button type=\"button\" class=\"sh-stat-card interactive\" data-sh-panel=\"rocket\">" +
            "<div class=\"sh-stat-title\">火箭補給庫存</div>" +
            "<div class=\"sh-stat-val\">" + data.status.rocketSupply + " 枚</div>" +
            "<div class=\"sh-stat-hint\">點擊查看說明</div>" +
          "</button>" +
          "<div class=\"sh-stat-card\">" +
            "<div class=\"sh-stat-title\">學習點數</div>" +
            "<div class=\"sh-stat-val\">" + data.status.learningPoints + " 點</div>" +
            "<div class=\"sh-stat-hint\" style=\"color:#34d399;\">持續累積中</div>" +
          "</div>" +
        "</div>" +
      "</div>" +

      // 3. 主要學習入口
      "<div class=\"sh-panel\">" +
        "<div class=\"sh-section-label\">選擇航道・主要學習入口</div>" +
        "<div class=\"sh-entry-grid\">" +
          "<button type=\"button\" class=\"sh-entry-card sh-entry-topic\" data-sh-panel=\"topic\">" +
            "<span class=\"sh-entry-badge\">自主觀念探索</span>" +
            "<h2 class=\"sh-entry-name\">主題學習</h2>" +
            "<p class=\"sh-entry-desc\">依數學觀念主題循序拆解，從例子與反例出發，搭配分層提示釐清觀念。</p>" +
            "<span class=\"sh-entry-cta\">進入主題學習模式選擇 →</span>" +
          "</button>" +
          "<button type=\"button\" class=\"sh-entry-card sh-entry-school\" data-sh-panel=\"school\">" +
            "<span class=\"sh-entry-badge\">課程與班級同步</span>" +
            "<h2 class=\"sh-entry-name\">學校學習</h2>" +
            "<p class=\"sh-entry-desc\">對齊學校課程單元與班級邀請碼，追蹤課堂進度與作答診斷歷程。</p>" +
            "<span class=\"sh-entry-cta\">進入學校課程選擇 →</span>" +
          "</button>" +
        "</div>" +
        renderActiveDrawer(data) +
      "</div>" +

      // 4. 今日學習 & 5. 成就及進度
      "<div class=\"sh-two-col\">" +
        "<div class=\"sh-panel\" style=\"margin-bottom:0;\">" +
          "<div class=\"sh-section-label\">今日學習任務</div>" +
          "<p style=\"margin:0 0 10px;font-size:13px;font-weight:600;color:#f8fafc;\">今日目標：" + esc(data.today.goal) + "</p>" +
          "<p style=\"margin:0 0 8px;font-size:12px;color:#94a3b8;\">最近學習單元：" + esc(data.today.recentUnit) + "</p>" +
          "<ul class=\"sh-list\">" +
            data.today.pendingTasks.map(function (t) {
              return "<li><span>" + esc(t.title) + "</span><span class=\"sh-tag\">" + esc(t.tag) + "</span></li>";
            }).join("") +
          "</ul>" +
        "</div>" +
        "<div class=\"sh-panel\" style=\"margin-bottom:0;\">" +
          "<div class=\"sh-section-label\">成就與學習進度</div>" +
          "<div class=\"sh-ach-grid\">" +
            "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.streakDays + " 天</div><div class=\"sh-ach-txt\">連續學習</div></div>" +
            "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.completedUnits + " 項</div><div class=\"sh-ach-txt\">已完成單元</div></div>" +
            "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.badgesCount + " 枚</div><div class=\"sh-ach-txt\">學習成就</div></div>" +
          "</div>" +
          "<div style=\"font-size:12px;color:#cbd5e1;\">最新成就：<strong>" + esc(data.achievements.latestBadge) + "</strong></div>" +
        "</div>" +
      "</div>" +

      "</div></section>";

    // 綁定互動事件
    targetContainer.querySelectorAll("[data-sh-panel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var panelKey = btn.getAttribute("data-sh-panel");
        homeState.activePanel = homeState.activePanel === panelKey ? null : panelKey;
        renderStudentHome(targetContainer);
      });
    });

    var closeBtn = document.getElementById("sh-close-drawer");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        homeState.activePanel = null;
        renderStudentHome(targetContainer);
      });
    }

    var compactChk = document.getElementById("sh-toggle-compact");
    if (compactChk) {
      compactChk.addEventListener("change", function (e) {
        homeState.compactMode = Boolean(e.target.checked);
        renderStudentHome(targetContainer);
      });
    }

    targetContainer.querySelectorAll("[data-launch-legacy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof window.__openLegacyStudentWorkspace === "function") {
          window.__openLegacyStudentWorkspace();
        }
      });
    });
  }

  window.StudentHomeModule = {
    render: renderStudentHome,
    dataProvider: StudentHomeDataProvider
  };
})();

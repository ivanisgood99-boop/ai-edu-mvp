/* 學生端首頁與宇宙星球地圖（使用學生顯示名稱、星球星級精熟度、直線與圓單元） */
(function () {
  "use strict";

  var DEMO_HOME = {
    profile: {
      name: localStorage.getItem("edu_stu") || "星航學員",
      roleTitle: "宇宙探索見習生",
      classCode: localStorage.getItem("edu_code") || "MATH2026"
    },
    status: {
      progressPercent: 40,
      progressLabel: "航段進度（示範）",
      energyCurrent: 100,
      energyMax: 100,
      rocketSupply: 3,
      learningPoints: 240
    },
    today: {
      goal: "完成一個星球單元的循序學習與補救練習（示範）",
      recentUnit: "正整數次方（示範）",
      pendingTasks: [
        { id: "t1", title: "探索「正整數次方」星球關卡", tag: "可探索" },
        { id: "t2", title: "探索「直線與圓」星球航線", tag: "新單元" }
      ]
    },
    achievements: {
      streakDays: 4,
      completedUnits: 1,
      badgesCount: 2,
      latestBadge: "觀念釐清徽章（示範）"
    },
    topicPlanets: [
      { id: "M1-01", available: true, title: "正整數次方", desc: "乘方定義、負數次方與括號辨識", styleClass: "planet-math", isAssessment: false },
      { id: "M1-02", available: true, title: "零次方", desc: "非零底數零次方與底數限制", styleClass: "planet-math", isAssessment: false },
      { id: "M1-03", available: false, title: "負整數次方", desc: "教材建置中，尚未開放", styleClass: "planet-math", isAssessment: false }
    ],
    lineCirclePlanets: [
      { id: "LC-01", available: true, title: "坐標平面與點的關係", desc: "平面距離與方位關係", styleClass: "planet-geo", isAssessment: false },
      { id: "LC-02", available: true, title: "直線的斜率與傾斜程度", desc: "斜率定義與升降變化", styleClass: "planet-geo", isAssessment: false },
      { id: "LC-03", available: true, title: "直線方程式的建立與判讀", desc: "直線關係與代入檢驗", styleClass: "planet-geo", isAssessment: false },
      { id: "LC-04", available: true, title: "圓的方程式與圓心半徑", desc: "圓心、半徑與標準式", styleClass: "planet-geo", isAssessment: false },
      { id: "LC-05", available: true, title: "直線與圓的位置關係", desc: "距離與半徑比較判斷", styleClass: "planet-geo", isAssessment: false },
      { id: "LC-06", available: true, title: "直線與圓的綜合應用", desc: "坐標與圓的綜合解題", styleClass: "planet-geo", isAssessment: false },
      { id: "LC-ASSESS", available: true, title: "直線與圓星球綜合評量", desc: "單元第 2n+1 關卡綜合檢驗", styleClass: "planet-assess", isAssessment: true }
    ],
    schoolCourses: [
      { id: "LC-01", available: true, title: "高一上・直線與圓（2n+1 關卡航線）", desc: "包含 6 個知識點與 1 個星球綜合評量", styleClass: "planet-geo", isAssessment: false },
      { id: "M1-01", available: true, title: "數與式・正整數次方", desc: "循序六階段教學關卡", styleClass: "planet-math", isAssessment: false },
      { id: "M1-02", available: true, title: "數與式・零次方", desc: "循序六階段教學關卡", styleClass: "planet-math", isAssessment: false }
    ],
    explanations: {
      energy: "【示範說明】能量（100/100）為首頁展示數值，尚未與真實作答連動。",
      rocket: "【示範說明】火箭補給（3 枚）為首頁展示數值，目前僅供說明展示。"
    }
  };

  function getStarBadgeForStudent(nodeId, studentName) {
    if (!window.TeachingEngineModule || !window.TeachingEngineModule.repository || !window.TeachingEngineModule.evaluatePlanetStarRating) {
      return "尚未評定";
    }
    var sid = (studentName || localStorage.getItem("edu_stu") || "訪客學員").trim() || "訪客學員";
    var sess = window.TeachingEngineModule.repository.getNodeSession(sid, nodeId);
    var ev = window.TeachingEngineModule.evaluatePlanetStarRating(sess.logs, sess.starCode, sess.remedialPassed);
    return ev ? ev.studentLabel : "尚未評定";
  }

  var StudentHomeDataProvider = {
    getHomeSnapshot: function () {
      var base = JSON.parse(JSON.stringify(DEMO_HOME));
      var sn = localStorage.getItem("edu_stu");
      var sc = localStorage.getItem("edu_code");
      if (sn && sn.trim()) base.profile.name = sn.trim();
      if (sc && sc.trim()) base.profile.classCode = sc.trim();
      return base;
    }
  };

  var homeState = { activePanel: null };

  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderPlanetSvg(styleClass, isAssessment) {
    if (isAssessment) {
      return "<svg class=\"planet-svg\" viewBox=\"0 0 64 64\" width=\"54\" height=\"54\" aria-hidden=\"true\"><circle cx=\"32\" cy=\"32\" r=\"16\" fill=\"#2DD4BF\"/><ellipse cx=\"32\" cy=\"32\" rx=\"29\" ry=\"10\" fill=\"none\" stroke=\"#38BDF8\" stroke-width=\"2.2\" transform=\"rotate(-18 32 32)\"/><circle cx=\"32\" cy=\"32\" r=\"22\" fill=\"none\" stroke=\"rgba(168,85,247,0.65)\" stroke-width=\"1.5\" stroke-dasharray=\"4 3\"/></svg>";
    }
    if (styleClass === "planet-geo") {
      return "<svg class=\"planet-svg\" viewBox=\"0 0 64 64\" width=\"52\" height=\"52\" aria-hidden=\"true\"><circle cx=\"32\" cy=\"32\" r=\"18\" fill=\"#38BDF8\"/><path d=\"M16 28 Q32 22 48 30\" fill=\"none\" stroke=\"#E0F2FE\" stroke-width=\"2\"/><circle cx=\"25\" cy=\"24\" r=\"4\" fill=\"rgba(15,23,42,0.28)\"/></svg>";
    }
    return "<svg class=\"planet-svg\" viewBox=\"0 0 64 64\" width=\"52\" height=\"52\" aria-hidden=\"true\"><circle cx=\"32\" cy=\"32\" r=\"18\" fill=\"#818CF8\"/><ellipse cx=\"32\" cy=\"34\" rx=\"26\" ry=\"7\" fill=\"none\" stroke=\"#2DD4BF\" stroke-width=\"2\" transform=\"rotate(14 32 34)\"/></svg>";
  }
  function renderPlanetCards(list, studentName, modeLabel) {
    return list.map(function (item) {
      var starText = item.available ? getStarBadgeForStudent(item.id, studentName) : "尚未開放";
      var cls = "cosmos-planet-node" + (item.isAssessment ? " assessment-star" : "") + (!item.available ? " locked-planet" : "");
      return (
        "<div class=\"" + cls + "\">" +
          renderPlanetSvg(item.styleClass, item.isAssessment) +
          "<div class=\"planet-name\">" + esc(item.title) + "</div>" +
          "<div class=\"planet-desc\">" + esc(item.desc) + "</div>" +
          "<div class=\"cosmos-star-rating\">" + esc(starText) + "</div>" +
          (item.available
            ? "<button type=\"button\" class=\"sh-mini-btn primary\" data-launch-node=\"" + esc(item.id) + "\" data-launch-mode=\"" + esc(modeLabel) + "\">登陸星球</button>"
            : "<span class=\"sh-tag\">尚未開放</span>") +
        "</div>"
      );
    }).join("");
  }

  function renderActiveDrawer(data) {
    if (!homeState.activePanel) return "";
    var title = "", bodyHtml = "";
    if (homeState.activePanel === "topic") {
      title = "主題星球探索";
      bodyHtml = "<div class=\"cosmos-planet-grid\">" + renderPlanetCards(data.topicPlanets, data.profile.name, "topic") + "</div>";
    } else if (homeState.activePanel === "school") {
      title = "學校課程・直線與圓星球群（高一上・共 2n+1 關卡）";
      bodyHtml = "<div class=\"cosmos-planet-grid\">" + renderPlanetCards(data.lineCirclePlanets, data.profile.name, "school") + "</div>";
    } else if (homeState.activePanel === "profile") {
      title = "探索者資料（本機原型）";
      bodyHtml = "<div>學員名稱：<strong>" + esc(data.profile.name) + "</strong></div><div>稱號：" + esc(data.profile.roleTitle) + "</div><div>班級碼：" + esc(data.profile.classCode) + "</div>";
    } else if (homeState.activePanel === "settings") {
      title = "星圖說明";
      bodyHtml = "<div>星星精熟度依作答證據、提示依賴與補救表現更新；證據不足顯示「尚未評定」，單次失誤不會立即降星。</div>";
    } else if (homeState.activePanel === "energy") {
      title = "能量說明（示範資料）";
      bodyHtml = "<div>" + esc(data.explanations.energy) + "</div>";
    } else if (homeState.activePanel === "rocket") {
      title = "火箭補給說明（示範資料）";
      bodyHtml = "<div>" + esc(data.explanations.rocket) + "</div>";
    }
    return "<div class=\"sh-drawer\"><div class=\"sh-drawer-head\"><span>" + esc(title) + "</span><button type=\"button\" class=\"sh-mini-btn\" id=\"sh-close-drawer\">關閉</button></div>" + bodyHtml + "</div>";
  }

  function renderStudentHome(targetContainer) {
    if (!targetContainer) return;
    var data = StudentHomeDataProvider.getHomeSnapshot();

    targetContainer.innerHTML =
      "<section class=\"space-home-root\" aria-label=\"宇宙探索首頁\">" +
        "<div class=\"nebula-layer\" aria-hidden=\"true\"></div>" +
        "<div class=\"space-content\">" +
          "<div class=\"sh-topbar\">" +
            "<div class=\"sh-brand\">" +
              "<div class=\"sh-logo-mark\" aria-hidden=\"true\">✦</div>" +
              "<div><h1 class=\"sh-title\">星航智學・宇宙學習地圖</h1>" +
              "<p class=\"sh-subtitle\">歡迎回來，" + esc(data.profile.name) + "｜航段數值與成就為示範資料</p></div>" +
            "</div>" +
            "<div class=\"sh-top-actions\">" +
              "<button type=\"button\" class=\"sh-icon-btn\" data-sh-panel=\"profile\">個人資料</button>" +
              "<button type=\"button\" class=\"sh-icon-btn\" data-sh-panel=\"settings\">星級說明</button>" +
            "</div>" +
          "</div>" +

          "<div class=\"sh-panel\">" +
            "<div class=\"sh-section-label\">航行狀態（示範資料）</div>" +
            "<div class=\"sh-status-grid\">" +
              "<div class=\"sh-stat-card\"><div class=\"sh-stat-title\">" + esc(data.status.progressLabel) + "</div><div class=\"sh-stat-val\">" + data.status.progressPercent + "%</div><div class=\"sh-progress-track\"><div class=\"sh-progress-fill\" style=\"width:" + data.status.progressPercent + "%;\"></div></div></div>" +
              "<button type=\"button\" class=\"sh-stat-card interactive\" data-sh-panel=\"energy\"><div class=\"sh-stat-title\">能量（示範）</div><div class=\"sh-stat-val\">" + data.status.energyCurrent + "/" + data.status.energyMax + "</div><div class=\"sh-stat-hint\">點擊查看說明</div></button>" +
              "<button type=\"button\" class=\"sh-stat-card interactive\" data-sh-panel=\"rocket\"><div class=\"sh-stat-title\">火箭補給（示範）</div><div class=\"sh-stat-val\">" + data.status.rocketSupply + " 枚</div><div class=\"sh-stat-hint\">點擊查看說明</div></button>" +
              "<div class=\"sh-stat-card\"><div class=\"sh-stat-title\">學習點數（示範）</div><div class=\"sh-stat-val\">" + data.status.learningPoints + " 點</div><div class=\"sh-stat-hint\">原型示範數值</div></div>" +
            "</div>" +
          "</div>" +

          "<div class=\"sh-panel\">" +
            "<div class=\"sh-section-label\">星球航道入口</div>" +
            "<div class=\"sh-entry-grid\">" +
              "<button type=\"button\" class=\"sh-entry-card sh-entry-topic\" data-sh-panel=\"topic\">" +
                "<span class=\"sh-entry-badge\">主題星球</span>" +
                "<h2 class=\"sh-entry-name\">主題學習</h2>" +
                "<p class=\"sh-entry-desc\">挑選個別知識星球，查看星級精熟度並進入循序六階段教學。</p>" +
                "<span class=\"sh-entry-cta\">展開主題星球 →</span>" +
              "</button>" +
              "<button type=\"button\" class=\"sh-entry-card sh-entry-school\" data-sh-panel=\"school\">" +
                "<span class=\"sh-entry-badge\">高一上・直線與圓</span>" +
                "<h2 class=\"sh-entry-name\">學校學習</h2>" +
                "<p class=\"sh-entry-desc\">探索直線與圓 6 個知識星球與第 2n+1 關卡星球綜合評量。</p>" +
                "<span class=\"sh-entry-cta\">展開直線與圓星圖 →</span>" +
              "</button>" +
            "</div>" +
            renderActiveDrawer(data) +
          "</div>" +

          "<div class=\"sh-two-col\">" +
            "<div class=\"sh-panel\" style=\"margin-bottom:0;\">" +
              "<div class=\"sh-section-label\">今日任務（示範資料）</div>" +
              "<ul class=\"sh-list\">" +
                data.today.pendingTasks.map(function (t) { return "<li><span>" + esc(t.title) + "</span><span class=\"sh-tag\">" + esc(t.tag) + "</span></li>"; }).join("") +
              "</ul>" +
            "</div>" +
            "<div class=\"sh-panel\" style=\"margin-bottom:0;\">" +
              "<div class=\"sh-section-label\">探索成就（示範資料）</div>" +
              "<div class=\"sh-ach-grid\">" +
                "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.streakDays + " 天</div><div class=\"sh-ach-txt\">連續學習（示範）</div></div>" +
                "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.completedUnits + " 項</div><div class=\"sh-ach-txt\">已完成（示範）</div></div>" +
                "<div class=\"sh-ach-box\"><div class=\"sh-ach-num\">" + data.achievements.badgesCount + " 枚</div><div class=\"sh-ach-txt\">徽章（示範）</div></div>" +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</section>";

    targetContainer.querySelectorAll("[data-sh-panel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pk = btn.getAttribute("data-sh-panel");
        homeState.activePanel = homeState.activePanel === pk ? null : pk;
        renderStudentHome(targetContainer);
      });
    });

    var closeBtn = document.getElementById("sh-close-drawer");
    if (closeBtn) closeBtn.addEventListener("click", function () { homeState.activePanel = null; renderStudentHome(targetContainer); });

    targetContainer.querySelectorAll("[data-launch-node]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var nid = btn.getAttribute("data-launch-node");
        var mode = btn.getAttribute("data-launch-mode") || "topic";
        if (typeof window.__openTeachingEngineForNode === "function") window.__openTeachingEngineForNode(nid, mode);
      });
    });
  }

  window.StudentHomeModule = { render: renderStudentHome, dataProvider: StudentHomeDataProvider };
})();

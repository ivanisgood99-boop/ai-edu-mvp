/* 學生端首頁與星際探索入口（綁定 Supabase Auth；未登入不建立虛構學生） */
(function () {
  "use strict";

  var ui = {
    mode: "login", // "login" | "signup" | "forgot"
    statusMsg: "",
    statusOk: false,
    user: null,
    profile: null,
    resources: null,
    loading: true
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderAuthGate(target) {
    var isLogin = ui.mode === "login";
    var isSignup = ui.mode === "signup";
    var isForgot = ui.mode === "forgot";

    var formFields = "";
    if (isSignup) {
      formFields =
        "<label style=\"display:block;margin-bottom:8px;font-size:13px;\">顯示名稱（非唯一識別）" +
        "<input id=\"auth-name\" type=\"text\" placeholder=\"例如：林小宇\" style=\"width:100%;margin-top:4px;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#f8fafc;\" /></label>" +
        "<label style=\"display:block;margin-bottom:8px;font-size:13px;\">電子郵件" +
        "<input id=\"auth-email\" type=\"email\" placeholder=\"student@example.com\" style=\"width:100%;margin-top:4px;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#f8fafc;\" /></label>" +
        "<label style=\"display:block;margin-bottom:12px;font-size:13px;\">設定密碼（至少 6 碼）" +
        "<input id=\"auth-password\" type=\"password\" placeholder=\"請輸入密碼\" style=\"width:100%;margin-top:4px;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#f8fafc;\" /></label>" +
        "<button id=\"auth-submit-btn\" type=\"button\" class=\"sh-mini-btn primary\">建立學生帳號</button>";
    } else if (isForgot) {
      formFields =
        "<label style=\"display:block;margin-bottom:12px;font-size:13px;\">註冊電子郵件（忘記密碼／寄送重設信）" +
        "<input id=\"auth-email\" type=\"email\" placeholder=\"student@example.com\" style=\"width:100%;margin-top:4px;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#f8fafc;\" /></label>" +
        "<button id=\"auth-submit-btn\" type=\"button\" class=\"sh-mini-btn primary\">寄送密碼重設信</button>";
    } else {
      formFields =
        "<label style=\"display:block;margin-bottom:8px;font-size:13px;\">電子郵件" +
        "<input id=\"auth-email\" type=\"email\" placeholder=\"student@example.com\" style=\"width:100%;margin-top:4px;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#f8fafc;\" /></label>" +
        "<label style=\"display:block;margin-bottom:12px;font-size:13px;\">密碼" +
        "<input id=\"auth-password\" type=\"password\" placeholder=\"請輸入密碼\" style=\"width:100%;margin-top:4px;padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#f8fafc;\" /></label>" +
        "<button id=\"auth-submit-btn\" type=\"button\" class=\"sh-mini-btn primary\">正式登入</button>";
    }

    var msgHtml = ui.statusMsg
      ? "<div style=\"margin-top:10px;padding:8px 12px;border-radius:8px;font-size:13px;background:" + (ui.statusOk ? "rgba(20,184,166,0.18)" : "rgba(248,113,113,0.18)") + ";color:" + (ui.statusOk ? "#5EEAD4" : "#FCA5A5") + ";\">" + esc(ui.statusMsg) + "</div>"
      : "";

    target.innerHTML =
      "<section class=\"space-home-root nebula-default\" aria-label=\"學生登入與註冊\">" +
      "<div class=\"nebula-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"starfield-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"space-content\" style=\"max-width:560px;margin:0 auto;padding:24px 16px;\">" +
      "<div class=\"sh-panel\" style=\"padding:20px;border-radius:14px;background:rgba(15,23,42,0.88);border:1px solid rgba(148,163,184,0.3);color:#f8fafc;\">" +
      "<div style=\"font-size:12px;color:#38BDF8;margin-bottom:4px;\">✦ 星航智學・學生帳號驗證</div>" +
      "<h1 class=\"sh-title\" style=\"margin:0 0 8px 0;\">請先登入或註冊學生帳號</h1>" +
      "<p class=\"sh-subtitle\" style=\"margin:0 0 14px 0;color:#CBD5E1;\">每位學生皆以正式帳號綁定學習紀錄與資源；未登入不會自動建立示範學員。</p>" +
      "<div style=\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;\">" +
      "<button type=\"button\" class=\"sh-mini-btn" + (isLogin ? " primary" : "") + "\" data-auth-tab=\"login\">學生登入</button>" +
      "<button type=\"button\" class=\"sh-mini-btn" + (isSignup ? " primary" : "") + "\" data-auth-tab=\"signup\">學生註冊</button>" +
      "<button type=\"button\" class=\"sh-mini-btn" + (isForgot ? " primary" : "") + "\" data-auth-tab=\"forgot\">忘記密碼</button>" +
      "</div>" +
      formFields +
      msgHtml +
      "</div>" +
      "</div>" +
      "</section>";

    target.querySelectorAll("[data-auth-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ui.mode = btn.getAttribute("data-auth-tab");
        ui.statusMsg = "";
        renderStudentHome(target);
      });
    });

    var subBtn = document.getElementById("auth-submit-btn");
    if (subBtn && window.AuthSystemModule) {
      subBtn.addEventListener("click", async function () {
        var emailEl = document.getElementById("auth-email");
        var pwdEl = document.getElementById("auth-password");
        var nameEl = document.getElementById("auth-name");
        var emailVal = emailEl ? emailEl.value : "";
        var pwdVal = pwdEl ? pwdEl.value : "";
        var nameVal = nameEl ? nameEl.value : "";

        var r;
        if (ui.mode === "signup") {
          r = await window.AuthSystemModule.signUpStudent(emailVal, pwdVal, nameVal);
        } else if (ui.mode === "forgot") {
          r = await window.AuthSystemModule.sendPasswordReset(emailVal, window.location.href);
        } else {
          r = await window.AuthSystemModule.signInStudent(emailVal, pwdVal);
        }
        ui.statusOk = Boolean(r && r.ok);
        ui.statusMsg = (r && r.message) || "操作完成";
        await syncAndRender(target);
      });
    }
  }

  async function syncAndRender(target) {
    if (!target) return;
    if (!window.AuthSystemModule) {
      ui.loading = false;
      renderAuthGate(target);
      return;
    }
    var sess = await window.AuthSystemModule.getCurrentSession();
    if (!sess.user) {
      ui.user = null;
      ui.profile = null;
      ui.resources = null;
      ui.loading = false;
      renderAuthGate(target);
      return;
    }
    ui.user = sess.user;
    var bundle = await window.AuthSystemModule.loadStudentProfileAndResources(sess.user);
    ui.profile = bundle.profile;
    ui.resources = bundle.resources;
    ui.loading = false;

    var displayName = (ui.profile && ui.profile.display_name) || ui.user.email || "已登入學員";
    var role = (ui.profile && ui.profile.role) || "student";
    var resData = ui.resources || {};
    var pts = typeof resData.learning_points === "number" ? resData.learning_points : "尚未建立紀錄";
    var stam = typeof resData.stamina === "number" ? (resData.stamina + " / " + (resData.stamina_max || 100)) : "尚未建立紀錄";
    var rockets = typeof resData.rocket_supplies === "number" ? resData.rocket_supplies : "尚未建立紀錄";
    var stardust = typeof resData.stardust === "number" ? resData.stardust : "尚未建立紀錄";
    var gems = typeof resData.gems === "number" ? resData.gems : "尚未建立紀錄";

    target.innerHTML =
      "<section class=\"space-home-root nebula-default\" aria-label=\"學生首頁\">" +
      "<div class=\"nebula-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"starfield-layer\" aria-hidden=\"true\"></div>" +
      "<div class=\"space-content\" style=\"max-width:920px;margin:0 auto;padding:20px 16px;color:#f8fafc;\">" +
      "<div class=\"sh-panel\" style=\"padding:18px;border-radius:14px;background:rgba(15,23,42,0.88);border:1px solid rgba(148,163,184,0.3);\">" +
      "<div style=\"display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;\">" +
      "<div>" +
      "<div style=\"font-size:12px;color:#38BDF8;\">✦ 個人資料區・身分：" + esc(role) + "</div>" +
      "<h1 class=\"sh-title\" style=\"margin:2px 0;\">歡迎回來，" + esc(displayName) + "</h1>" +
      "<div style=\"font-size:12px;color:#94A3B8;\">帳號信箱：" + esc(ui.user.email || "") + "</div>" +
      "</div>" +
      "<button type=\"button\" class=\"sh-mini-btn\" id=\"sh-logout-btn\">登出</button>" +
      "</div>" +
      "<div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px;font-size:13px;\">" +
      "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);\"><div>⚡ 流星體力</div><strong>" + esc(stam) + "</strong></div>" +
      "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);\"><div>🚀 火箭補給</div><strong>" + esc(rockets) + "</strong></div>" +
      "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);\"><div>📘 學習點數</div><strong>" + esc(pts) + "</strong></div>" +
      "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);\"><div>✦ 星塵</div><strong>" + esc(stardust) + "</strong></div>" +
      "<div style=\"padding:10px;border-radius:10px;background:rgba(30,41,59,0.75);\"><div>💎 寶石</div><strong>" + esc(gems) + "</strong></div>" +
      "</div>" +
      "<div style=\"display:flex;gap:10px;flex-wrap:wrap;\">" +
      "<button type=\"button\" class=\"sh-mini-btn primary\" id=\"sh-open-engine-s1\">進入六階段教學（Stage X-1 觀念學習）</button>" +
      "<button type=\"button\" class=\"sh-mini-btn\" id=\"sh-open-engine-s2\">進入刷題練習（Stage X-2）</button>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>";

    var logoutBtn = document.getElementById("sh-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        ui.statusMsg = "";
        await window.AuthSystemModule.signOutStudent();
        await syncAndRender(target);
      });
    }

    var b1 = document.getElementById("sh-open-engine-s1");
    if (b1 && typeof window.__openTeachingEngineForNode === "function") {
      b1.addEventListener("click", function () {
        window.__openTeachingEngineForNode("CH2-L1", "X-1");
      });
    }

    var b2 = document.getElementById("sh-open-engine-s2");
    if (b2 && typeof window.__openTeachingEngineForNode === "function") {
      b2.addEventListener("click", function () {
        window.__openTeachingEngineForNode("CH2-L1", "X-2");
      });
    }
  }

  function renderStudentHome(target) {
    if (!target) return;
    if (ui.loading) {
      target.innerHTML = "<div style=\"padding:24px;color:#e2e8f0;\">正在檢查登入狀態...</div>";
      syncAndRender(target);
      return;
    }
    if (!ui.user) {
      renderAuthGate(target);
    } else {
      syncAndRender(target);
    }
  }

  if (window.AuthSystemModule) {
    window.AuthSystemModule.subscribeAuthState(function () {
      var host = document.getElementById("studentHomeRoot") || document.getElementById("app");
      if (host) syncAndRender(host);
    });
  }

  window.StudentHomeModule = { render: renderStudentHome };
})();

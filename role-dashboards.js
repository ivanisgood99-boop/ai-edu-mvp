(function () {
  "use strict";

  var state = { target: null, role: null, busy: false };

  function client() {
    return window.AuthSystemModule && window.AuthSystemModule.getClient
      ? window.AuthSystemModule.getClient()
      : null;
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function shell(title, subtitle, body) {
    return '<section class="sh-panel" style="max-width:1100px;margin:0 auto">' +
      '<h2 style="margin:0 0 6px">' + esc(title) + '</h2>' +
      '<p style="color:#cbd5e1;font-size:13px;margin:0 0 16px">' + esc(subtitle) + '</p>' +
      body + '</section>';
  }
  function banner(message, ok) {
    return '<div class="' + (ok ? 'sh-banner-ok' : 'sh-banner-err') + '">' + esc(message) + '</div>';
  }
  function button(label, attrs) {
    return '<button type="button" class="sh-btn primary" ' + (attrs || '') + '>' + esc(label) + '</button>';
  }
  function field(label, id, placeholder, type) {
    return '<label style="display:block;font-size:13px;margin:10px 0">' + esc(label) +
      '<input id="' + esc(id) + '" type="' + (type || 'text') + '" required placeholder="' + esc(placeholder || '') +
      '" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff"></label>';
  }
  async function identity(requiredRole) {
    var auth = window.AuthSystemModule;
    if (!auth) throw new Error("登入模組尚未載入");
    var session = await auth.getCurrentSession();
    if (!session.user) throw new Error("請先登入");
    var profile = await auth.getCurrentProfile();
    if (!profile || profile.account_status !== "active") throw new Error("帳號尚未啟用");
    if (requiredRole && profile.role !== requiredRole && !(requiredRole === "teacher" && profile.role === "admin")) {
      throw new Error("此頁面僅限" + (requiredRole === "teacher" ? "教師" : "管理員") + "使用");
    }
    return { user: session.user, profile: profile, db: client() };
  }
  function showError(target, title, error) {
    target.innerHTML = shell(title, "系統已阻擋未授權存取；若是資料庫政策尚未部署，請先完成預覽驗收。", banner(error && error.message ? error.message : String(error), false));
  }

  async function renderTeacher(target) {
    try {
      var ctx = await identity("teacher");
      var db = ctx.db;
      var result = await db.from("classes").select("id,class_name,invite_code,created_at")
        .eq("teacher_id", ctx.user.id).order("created_at", { ascending: false });
      if (result.error) throw result.error;
      var cards = [];
      for (var i = 0; i < (result.data || []).length; i++) {
        var cls = result.data[i];
        var enroll = await db.from("class_enrollments").select("student_id,joined_at")
          .eq("class_id", cls.id);
        if (enroll.error) throw enroll.error;
        var ids = (enroll.data || []).map(function (x) { return x.student_id; });
        var names = [];
        var stats = [];
        if (ids.length) {
          var p = await db.from("profiles").select("id,display_name").in("id", ids);
          if (p.error) throw p.error;
          names = p.data || [];
          var s = await db.from("learning_statistics").select("student_id,level_id,level_completed,mastery_level").in("student_id", ids);
          if (s.error) throw s.error;
          stats = s.data || [];
        }
        var rows = ids.map(function (id) {
          var person = names.find(function (x) { return x.id === id; });
          var done = stats.filter(function (x) { return x.student_id === id && x.level_completed; }).length;
          return '<tr><td>' + esc(person ? person.display_name : '學生') + '</td><td>' + done + ' 關</td></tr>';
        }).join("");
        cards.push('<article class="sh-card" style="margin:10px 0"><h3>' + esc(cls.class_name) + '</h3>' +
          '<p>班級代碼：<strong>' + esc(cls.invite_code) + '</strong>　｜　學生：' + ids.length + ' 人</p>' +
          '<div style="overflow:auto"><table style="width:100%;text-align:left"><thead><tr><th>學生</th><th>完成關卡</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="2">尚無學生加入</td></tr>') + '</tbody></table></div></article>');
      }
      target.innerHTML = shell("教師班級", "建立班級、分享邀請碼，查看班級學生的學習進度。", 
        '<form id="rdCreateClass">' + field("班級名稱","rdClassName","例如：高一數學 A 班") +
        '<button class="sh-btn primary" type="submit">建立班級</button></form>' +
        (cards.join("") || '<p class="sh-card">目前尚未建立班級。</p>'));
    } catch (e) { showError(target, "教師班級", e); }
  }

  async function renderAdmin(target) {
    try {
      var ctx = await identity("admin"), db = ctx.db;
      var [profiles, apps, logs] = await Promise.all([
        db.from("profiles").select("id,display_name,role,account_status,created_at").order("created_at",{ascending:false}).limit(100),
        db.from("teacher_applications").select("id,teacher_name,subject,status,applicant_id,created_at").order("created_at",{ascending:false}).limit(100),
        db.from("platform_audit_logs").select("id,actor_id,action,target_table,target_id,details,created_at").order("created_at",{ascending:false}).limit(30)
      ]);
      if (profiles.error) throw profiles.error;
      if (apps.error) throw apps.error;
      if (logs.error) throw logs.error;
      var profileRows = (profiles.data || []).map(function (p) {
        return '<tr><td>' + esc(p.display_name) + '</td><td>' + esc(p.role) + '</td><td>' + esc(p.account_status) +
          '</td><td>' + (p.id === ctx.user.id ? '目前帳號' :
          '<button class="sh-btn" data-account-id="' + esc(p.id) + '" data-next-status="' +
          (p.account_status === 'active' ? 'suspended' : 'active') + '">' +
          (p.account_status === 'active' ? '停用' : '恢復') + '</button>') + '</td></tr>';
      }).join("");
      var appRows = (apps.data || []).map(function (a) {
        var actions = a.status === "pending" && a.applicant_id
          ? '<button class="sh-btn primary" data-app-id="' + a.id + '" data-decision="approved">核准</button> ' +
            '<button class="sh-btn" data-app-id="' + a.id + '" data-decision="rejected">退回</button>'
          : (a.applicant_id ? "已處理" : "舊申請：需人工核實帳號");
        return '<tr><td>' + esc(a.teacher_name) + '</td><td>' + esc(a.subject || '') +
          '</td><td>' + esc(a.status) + '</td><td>' + actions + '</td></tr>';
      }).join("");
      var logRows = (logs.data || []).map(function (l) {
        return '<tr><td>' + esc(l.action) + '</td><td>' + esc(l.target_table || '') +
          '</td><td>' + esc(l.created_at) + '</td></tr>';
      }).join("");
      target.innerHTML = shell("平台管理", "管理帳號狀態、教師申請與平台稽核紀錄。所有變更均由資料庫權限與管理 RPC 驗證。",
        '<h3>教師申請</h3><div style="overflow:auto"><table style="width:100%;text-align:left"><thead><tr><th>申請人</th><th>科目</th><th>狀態</th><th>操作</th></tr></thead><tbody>' +
        (appRows || '<tr><td colspan="4">目前沒有申請</td></tr>') + '</tbody></table></div>' +
        '<h3 style="margin-top:24px">帳號管理</h3><div style="overflow:auto"><table style="width:100%;text-align:left"><thead><tr><th>名稱</th><th>角色</th><th>狀態</th><th>操作</th></tr></thead><tbody>' +
        (profileRows || '<tr><td colspan="4">沒有帳號資料</td></tr>') + '</tbody></table></div>' +
        '<h3 style="margin-top:24px">最近稽核紀錄</h3><div style="overflow:auto"><table style="width:100%;text-align:left"><thead><tr><th>操作</th><th>對象</th><th>時間</th></tr></thead><tbody>' +
        (logRows || '<tr><td colspan="3">尚無稽核紀錄</td></tr>') + '</tbody></table></div>');
    } catch (e) { showError(target, "平台管理", e); }
  }

  async function renderRewards(target) {
    try {
      var ctx = await identity("student"), db = ctx.db, uid = ctx.user.id;
      var results = await Promise.all([
        db.from("student_resources").select("learning_points,stamina,stamina_max,rocket_supplies,stardust,gems").eq("student_id",uid).single(),
        db.from("characters_catalog").select("id,name,stardust_cost,skill_spec").order("stardust_cost"),
        db.from("student_characters").select("character_id,is_equipped").eq("student_id",uid),
        db.from("skins_catalog").select("id,name,gem_cost,metadata").order("gem_cost"),
        db.from("student_skins").select("skin_id,is_equipped").eq("student_id",uid),
        db.from("achievements").select("id,title,description,category"),
        db.from("student_achievements").select("achievement_id,is_unlocked,unlocked_at").eq("student_id",uid),
        db.from("pk_matches").select("id,opponent_type,player_score,opponent_score,result,stardust_awarded,created_at").order("created_at",{ascending:false}).limit(10),
        db.from("lottery_draws").select("id,celestial_tier,reward_type,gems_awarded,skin_id,created_at").order("created_at",{ascending:false}).limit(10)
      ]);
      results.forEach(function (r) { if (r.error) throw r.error; });
      var res=results[0].data, ownedChars=results[2].data||[], skins=results[3].data||[], ownedSkins=results[4].data||[];
      var charRows=(results[1].data||[]).map(function(c){
        var own=ownedChars.find(function(x){return x.character_id===c.id;});
        return '<div class="sh-card" style="margin:8px 0"><strong>'+esc(c.name)+'</strong><p>星塵價格：'+c.stardust_cost+'</p>' +
          (own ? (own.is_equipped ? '目前使用中' : button('使用角色','data-equip-character="'+esc(c.id)+'"')) :
          button('兌換角色','data-buy-character="'+esc(c.id)+'"')+'</div>';
      }).join("");
      var skinRows=skins.map(function(s){
        var own=ownedSkins.find(function(x){return x.skin_id===s.id;});
        return '<div class="sh-card" style="margin:8px 0"><strong>'+esc(s.name)+'</strong><p>寶石價格：'+s.gem_cost+'</p>' +
          (own ? (own.is_equipped ? '目前使用中' : button('套用造型','data-equip-skin="'+esc(s.id)+'"')) :
          button('兌換造型','data-buy-skin="'+esc(s.id)+'"')+'</div>';
      }).join("");
      var ach=(results[5].data||[]).map(function(a){
        var got=(results[6].data||[]).find(function(x){return x.achievement_id===a.id&&x.is_unlocked;});
        return '<div class="sh-card" style="margin:6px 0"><strong>'+esc(a.title)+'</strong><p>'+esc(a.description)+'</p><small>'+(got?'已解鎖':'尚未解鎖')+'</small></div>';
      }).join("");
      var pk=(results[7].data||[]).map(function(x){return '<li>'+esc(x.result||'進行中')+'：'+x.player_score+' : '+x.opponent_score+'</li>';}).join("");
      var draws=(results[8].data||[]).map(function(x){return '<li>'+esc(x.celestial_tier)+'：'+esc(x.reward_type)+'（'+x.gems_awarded+' 寶石）</li>';}).join("");
      target.innerHTML=shell("星際收藏與資源中心","五種資源各自獨立記帳；購買與裝備由伺服器端原子操作。",
        '<div class="sh-grid">' +
        '<div class="sh-card"><small>學習點數</small><h3>'+res.learning_points+'</h3></div>' +
        '<div class="sh-card"><small>流星體力</small><h3>'+res.stamina+' / '+res.stamina_max+'</h3></div>' +
        '<div class="sh-card"><small>火箭補給</small><h3>'+res.rocket_supplies+'</h3></div>' +
        '<div class="sh-card"><small>星塵</small><h3>'+res.stardust+'</h3></div>' +
        '<div class="sh-card"><small>寶石</small><h3>'+res.gems+'</h3></div></div>' +
        '<h3>角色兌換</h3>'+(charRows||'<p class="sh-card">角色目錄尚未上架。</p>')+
        '<h3>造型商店</h3>'+(skinRows||'<p class="sh-card">造型目錄尚未上架。</p>')+
        '<h3>成就</h3>'+(ach||'<p class="sh-card">成就條件尚未設定。</p>')+
        '<h3>PK 紀錄</h3><ul>'+(pk||'<li>尚無對戰紀錄；對戰規則尚未上線。</li>')+'</ul>'+
        '<h3>星際抽獎紀錄</h3><ul>'+(draws||'<li>尚無抽獎紀錄；抽獎成本與機率規則尚待設定。</li>')+'</ul>'+
        '<h3>加入班級</h3><form id="rdJoinClass">'+field("8 位班級邀請碼","rdInviteCode","輸入教師提供的代碼")+'<button class="sh-btn primary" type="submit">加入班級</button></form>'+
        '<h3>申請成為教師</h3><form id="rdTeacherApply">'+field("任教科目","rdSubject","例如：高中數學")+'<button class="sh-btn" type="submit">送出教師申請</button></form>');
    } catch(e){showError(target,"星際收藏與資源中心",e);}
  }

  async function render(target, page) {
    state.target=target; state.role=page;
    if (!target) return;
    if (page==="teacher") return renderTeacher(target);
    if (page==="admin") return renderAdmin(target);
    if (page==="rewards") return renderRewards(target);
  }

  document.addEventListener("submit",async function(ev){
    if (!ev.target || !state.target) return;
    var db=client(), form=ev.target, result;
    try {
      if (form.id==="rdCreateClass") {
        ev.preventDefault(); var name=document.getElementById("rdClassName").value.trim();
        result=await db.rpc("create_teacher_class",{p_class_name:name});
        if(result.error)throw result.error;
        await render(state.target,"teacher");
      } else if(form.id==="rdJoinClass") {
        ev.preventDefault(); var code=document.getElementById("rdInviteCode").value.trim();
        result=await db.rpc("join_class_by_invite_code",{p_invite_code:code});
        if(result.error)throw result.error;
        await render(state.target,"rewards");
      } else if(form.id==="rdTeacherApply") {
        ev.preventDefault(); var subject=document.getElementById("rdSubject").value.trim();
        result=await db.rpc("submit_teacher_application",{p_subject:subject});
        if(result.error)throw result.error;
        state.target.insertAdjacentHTML("afterbegin",banner("教師申請已送出。",true));
      }
    } catch(e){state.target.insertAdjacentHTML("afterbegin",banner(e.message||String(e),false));}
  });

  document.addEventListener("click",async function(ev){
    var t=ev.target;if(!t||!state.target)return;
    var app=t.closest("[data-app-id]"), account=t.closest("[data-account-id]");
    var buyChar=t.closest("[data-buy-character]"), buySkin=t.closest("[data-buy-skin]");
    var equipChar=t.closest("[data-equip-character]"), equipSkin=t.closest("[data-equip-skin]");
    try{
      var db=client(),r;
      if(app){r=await db.rpc("review_teacher_application",{p_application_id:Number(app.dataset.appId),p_decision:app.dataset.decision});if(r.error)throw r.error;await render(state.target,"admin");}
      else if(account){r=await db.from("profiles").update({account_status:account.dataset.nextStatus}).eq("id",account.dataset.accountId);if(r.error)throw r.error;await render(state.target,"admin");}
      else if(buyChar){r=await db.rpc("purchase_character",{p_character_id:buyChar.dataset.buyCharacter});if(r.error)throw r.error;await render(state.target,"rewards");}
      else if(buySkin){r=await db.rpc("purchase_skin",{p_skin_id:buySkin.dataset.buySkin});if(r.error)throw r.error;await render(state.target,"rewards");}
      else if(equipChar){r=await db.rpc("equip_character",{p_character_id:equipChar.dataset.equipCharacter});if(r.error)throw r.error;await render(state.target,"rewards");}
      else if(equipSkin){r=await db.rpc("equip_skin",{p_skin_id:equipSkin.dataset.equipSkin});if(r.error)throw r.error;await render(state.target,"rewards");}
    }catch(e){state.target.insertAdjacentHTML("afterbegin",banner(e.message||String(e),false));}
  });

  window.RoleDashboardModule={render:render};
})();
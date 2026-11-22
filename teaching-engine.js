(function(){
"use strict";

var EXP={minQ:2,masteryRatio:0.75,progressRatio:0.40};
var ERR={E01:"定義理解錯誤",E02:"性質使用錯誤",E03:"忽略適用條件",E04:"運算錯誤",E05:"推論錯誤",E06:"題意理解或建模錯誤",E07:"抄寫或計算疏失"};
var STORE_KEY="ai_edu_phase2_records_v2";

function fixGuide(code,ans,nodeId,ctx){
  var a=String(ans||"").trim();
  if(ctx==="contradiction_sign") return {ok1:"這句說法把正負號的奇偶規律寫反了，我們一起重新對照乘方的符號規則。",ok2:"負數作偶數次方（如 2 次、4 次）結果為正；作奇數次方（如 1 次、3 次）結果為負。"};
  if(ctx==="zero_power_includes_zero") return {ok1:"提到零次方為 1 有抓到部分概念，但「包括 0」需要修正。",ok2:"零指數的前提是底數不能為 0；0 的 0 次方不在一般 a^0 = 1 規定內。"};
  if(code==="E01"){
    if(nodeId==="M1-01"&&(a.indexOf("6")!==-1||a.indexOf("15")!==-1||a.indexOf("×")!==-1)) return {ok1:"次方是「相同底數連續相乘」，不是直接乘以次數。",ok2:"先把底數寫出來連乘，例如 2^3 是 2 × 2 × 2 = 8。"};
    if(nodeId==="M1-02"&&a.indexOf("0")!==-1) return {ok1:"看到 0 次方想到 0 是常見直覺，但非零數的 0 次方結果是 1。",ok2:"想想非零數自己除自己（如 5^2 ÷ 5^2）的規律。"};
    return {ok1:"我們先回到這個觀念的定義，看看題目問的是哪一種關係。",ok2:"先辨識底數與次方各代表什麼，再判斷算式。"};
  }
  if(code==="E02") return {ok1:"括號範圍或次方性質的運用有一點偏差，先看次方作用在誰身上。",ok2:"有括號包住負號時作用在整個括號；沒括號時先算次方再看負號。"};
  if(code==="E03") return {ok1:"方向接近了，但這題還要留意「底數不能為 0」的條件。",ok2:"把零指數底數寫出來，列出「底數 ≠ 0」再推導。"};
  if(code==="E04") return {ok1:"觀念方向不錯，計算過程中在正負號或數字運算遇到小阻礙。",ok2:"先分開算每一項的正負號與數值，再做加減。"};
  if(code==="E05") return {ok1:"推論過程還缺少完整的連結，我們把理由說得更清楚一些。",ok2:"試著用「因為……所以……」串起你的想法。"};
  if(code==="E06") return {ok1:"題目條件與作答還沒完全對齊，先看清楚題目問的是什麼。",ok2:"先確認題目給的條件與最後要回答的對象。"};
  return {ok1:"可能是看題或抄寫時漏看符號或數字，放慢腳步再檢查一次。",ok2:"對照題目數字與正負號，逐一確認後再送出。"};
}

var SemanticHook={
  customAnalyzer:null,
  analyzeExplanation:function(p){
    if(typeof this.customAnalyzer==="function") return this.customAnalyzer(p);
    var raw=String((p&&p.answer)||"").trim();
    var low=raw.toLowerCase();
    if(!raw||raw.length<=1||/^[\+\-]?\d+$/.test(raw)){
      return {verdict:"unclear",errorCode:"E05",contextKey:null,supplementPrompt:"只寫單一字詞或數字還看不出你的想法，請用完整句子補充說明理由。"};
    }
    if(p.nodeId==="M1-01"){
      var badOdd=(low.indexOf("奇")!==-1&&low.indexOf("正")!==-1&&low.indexOf("奇數次方是負")===-1&&low.indexOf("奇數次方為負")===-1)||(low.indexOf("(-2)^3")!==-1&&low.indexOf("正")!==-1&&low.indexOf("負")===-1);
      var badEven=(low.indexOf("偶")!==-1&&low.indexOf("負")!==-1&&low.indexOf("偶數次方是正")===-1&&low.indexOf("偶數次方為正")===-1)||(low.indexOf("(-2)^4")!==-1&&low.indexOf("負")!==-1&&low.indexOf("正")===-1);
      if(badOdd||badEven) return {verdict:"incorrect",errorCode:"E02",contextKey:"contradiction_sign",supplementPrompt:null};
      var oddNeg=low.indexOf("奇")!==-1&&low.indexOf("負")!==-1;
      var evenPos=low.indexOf("偶")!==-1&&low.indexOf("正")!==-1;
      var extra=low.indexOf("括號")!==-1||low.indexOf("連乘")!==-1||low.indexOf("次方")!==-1||low.indexOf("-8")!==-1||low.indexOf("16")!==-1;
      if((oddNeg&&evenPos)||((oddNeg||evenPos)&&extra)) return {verdict:"pass",errorCode:null,contextKey:null,supplementPrompt:null};
      if(oddNeg||evenPos||extra) return {verdict:"partial",errorCode:"E05",contextKey:null,supplementPrompt:"你已提到部分重點，請再補充奇數次方與偶數次方各自對應的正負號或括號影響。"};
      return {verdict:"unclear",errorCode:"E01",contextKey:null,supplementPrompt:"這段說明還看不出與負數次方正負號規律的關聯，請補充說明。"};
    }
    var incZero=(low.indexOf("包括 0")!==-1||low.indexOf("包括0")!==-1||low.indexOf("包含 0")!==-1||low.indexOf("包含0")!==-1||low.indexOf("0 的 0 次方")!==-1||low.indexOf("0的0次方")!==-1||(low.indexOf("任何數")!==-1&&low.indexOf("0")!==-1&&low.indexOf("不")===-1&&low.indexOf("≠")===-1&&low.indexOf("除")===-1));
    if(incZero&&(low.indexOf("零次方")!==-1||low.indexOf("0 次方")!==-1||low.indexOf("0次方")!==-1)){
      return {verdict:"incorrect",errorCode:"E03",contextKey:"zero_power_includes_zero",supplementPrompt:null};
    }
    var hasDiv=low.indexOf("除")!==-1||low.indexOf("相減")!==-1||low.indexOf("自己")!==-1||low.indexOf("相同")!==-1;
    var hasOne=low.indexOf("1")!==-1||low.indexOf("一")!==-1;
    var hasNonZero=low.indexOf("不為 0")!==-1||low.indexOf("不為0")!==-1||low.indexOf("非零")!==-1||low.indexOf("≠")!==-1||low.indexOf("不能為 0")!==-1||low.indexOf("不能為0")!==-1;
    if(hasDiv&&hasOne) return {verdict:"pass",errorCode:null,contextKey:null,supplementPrompt:null};
    if(hasDiv||hasOne||hasNonZero) return {verdict:"partial",errorCode:"E05",contextKey:null,supplementPrompt:"你抓到部分線索了，請再補充「相同非零數相除為 1」或「指數相減得零次方」的關聯。"};
    return {verdict:"unclear",errorCode:"E01",contextKey:null,supplementPrompt:"這段說明還沒有清楚連結到除法規律或非零底數條件，請再補充說明。"};
  }
};

var NODES={
  "M1-01":{
    id:"M1-01",code:"M1-01",title:"M1-01 正整數指數",
    stage1Material:"【教材重點｜M1-01 正整數指數】\n1. 定義：設 a 為任意實數，n 為正整數，a^n 表示 n 個 a 連續相乘（a × a × ... × a，共 n 個）。\n2. 正例：2^3 = 2 × 2 × 2 = 8；(-3)^2 = (-3) × (-3) = 9。\n3. 反例與提醒：2^3 不是 2 × 3 = 6；-3^2 代表 -(3 × 3) = -9，與 (-3)^2 不同。",
    stage2Guide:{questionId:"M1-01-S2-GUIDE",dimension:"推理能力",prompt:"想一想：當底數是負數時，次方次數是奇數或偶數，結果的正負號有什麼不同？請用自己的話說明為什麼 (-2)^3 與 (-2)^4 的正負號不同。",expectedAnswerDesc:"正確說明奇數次方為負、偶數次方為正",validate:function(v,nid){return SemanticHook.analyzeExplanation({nodeId:nid,stage:2,answer:v});}},
    stage3Check:{questionId:"M1-01-S3-CHECK",dimension:"概念理解",prompt:"【理解檢查】下列哪一個算式的值與 -5^2 相等？（請輸入 A、B 或 C）\nA. (-5)^2\nB. -(5 × 5)\nC. (-5) × 2",expectedAnswer:"B",validate:function(v){var u=String(v||"").trim().toUpperCase();if(!u)return {verdict:"unclear",ok:false,errorCode:"E06",supplementPrompt:"請輸入 A、B 或 C。"};if(u==="B")return {verdict:"pass",ok:true,errorCode:null};if(u==="A")return {verdict:"incorrect",ok:false,errorCode:"E02",contextKey:"contradiction_sign"};if(u==="C")return {verdict:"incorrect",ok:false,errorCode:"E01",contextKey:null};return {verdict:"unclear",ok:false,errorCode:"E05",supplementPrompt:"請輸入 A、B 或 C 其中一個選項。"};}},
    stage4Practice:{questionId:"M1-01-S4-PRACTICE",dimension:"基礎運算",prompt:"【互動練習】請計算 2^3 + (-3)^2 的值是多少？",expectedAnswer:"17",validate:function(v){var t=String(v||"").trim();if(!t)return {verdict:"unclear",ok:false,errorCode:"E06",supplementPrompt:"請輸入計算結果。"};if(!/^[\+\-]?\d+$/.test(t))return {verdict:"unclear",ok:false,errorCode:"E05",supplementPrompt:"請輸入整數數值。"};if(t==="17")return {verdict:"pass",ok:true,errorCode:null};if(t==="-1"||t==="1"||t==="-17")return {verdict:"incorrect",ok:false,errorCode:"E02",contextKey:"contradiction_sign"};if(t==="15"||t==="12")return {verdict:"incorrect",ok:false,errorCode:"E07",contextKey:null};return {verdict:"incorrect",ok:false,errorCode:"E04",contextKey:null};}},
    stage5Remedial:{questionId:"M1-01-S5-REMEDIAL",dimension:"應用能力",contextNote:"情境轉換：正方形地墊面積（2^2 = 4）與負數三次方（(-2)^3 = -8）合併計算",prompt:"【個人化補救題】一塊邊長為 2 公尺的正方形地墊，面積為 2^2 = 4 平方公尺；另有 (-2)^3（表示 (-2) 連乘 3 次）。請問「正方形面積（4）」加上「(-2)^3 的值」是多少？（例如 -4）",expectedAnswer:"-4",validate:function(v){var t=String(v||"").trim();if(!t)return {verdict:"unclear",ok:false,errorCode:"E06",supplementPrompt:"請輸入計算結果。"};if(!/^[\+\-]?\d+$/.test(t))return {verdict:"unclear",ok:false,errorCode:"E05",supplementPrompt:"請輸入整數數值。"};if(t==="-4")return {verdict:"pass",ok:true,errorCode:null};if(t==="12"||t==="4")return {verdict:"incorrect",ok:false,errorCode:"E02",contextKey:"contradiction_sign"};return {verdict:"incorrect",ok:false,errorCode:"E04",contextKey:null};}},
    hints:{H1:"先回想次方代表「連續相乘的次數」，並留意括號有沒有把負號包進去。",H2:"先分別看清楚每一項的底數與次方，再決定正負號與數值。",H3:"先算個別次方值（例如 2^2 = 4，(-2)^3 = -8），再依題意相加。",H4:"完整解析：2^2 = 4，(-2)^3 = -8，4 + (-8) = -4。"}
  },
  "M1-02":{
    id:"M1-02",code:"M1-02",title:"M1-02 零指數",
    stage1Material:"【教材重點｜M1-02 零指數】\n1. 定義：當底數 a ≠ 0 時，規定 a^0 = 1。\n2. 必要條件：若底數為 0，0^0 在數學上沒有意義，因此底數不能為 0。\n3. 正例與反例：7^0 = 1、(-6)^0 = 1；但 7^0 不等於 0，且 (x - 3)^0 = 1 時 x 必須 ≠ 3。",
    stage2Guide:{questionId:"M1-02-S2-GUIDE",dimension:"推理能力",prompt:"想一想：如果同底數相除時指數相減，例如 5^2 ÷ 5^2 會得到 5^0；從除法規律來看，為什麼非零數的 0 次方會規定為 1，而不是 0？請用自己的話說明。",expectedAnswerDesc:"說明非零數相除等於 1，且底數不可為 0",validate:function(v,nid){return SemanticHook.analyzeExplanation({nodeId:nid,stage:2,answer:v});}},
    stage3Check:{questionId:"M1-02-S3-CHECK",dimension:"概念理解",prompt:"【理解檢查】若 (x - 3)^0 = 1 成立，x 必須滿足什麼條件？（請輸入 A、B 或 C）\nA. x 可以是任意實數\nB. x ≠ 3\nC. x > 3",expectedAnswer:"B",validate:function(v){var u=String(v||"").trim().toUpperCase();if(!u)return {verdict:"unclear",ok:false,errorCode:"E06",supplementPrompt:"請輸入 A、B 或 C。"};if(u==="B")return {verdict:"pass",ok:true,errorCode:null};if(u==="A")return {verdict:"incorrect",ok:false,errorCode:"E03",contextKey:"zero_power_includes_zero"};if(u==="C")return {verdict:"incorrect",ok:false,errorCode:"E07",contextKey:null};return {verdict:"unclear",ok:false,errorCode:"E05",supplementPrompt:"請輸入 A、B 或 C 其中一個選項。"};}},
    stage4Practice:{questionId:"M1-02-S4-PRACTICE",dimension:"基礎運算",prompt:"【互動練習】請計算 (-6)^0 + 2^3 - 5^0 的值是多少？",expectedAnswer:"8",validate:function(v){var t=String(v||"").trim();if(!t)return {verdict:"unclear",ok:false,errorCode:"E06",supplementPrompt:"請輸入計算結果。"};if(!/^[\+\-]?\d+$/.test(t))return {verdict:"unclear",ok:false,errorCode:"E05",supplementPrompt:"請輸入整數數值。"};if(t==="8")return {verdict:"pass",ok:true,errorCode:null};if(t==="7"||t==="2"||t==="0")return {verdict:"incorrect",ok:false,errorCode:"E01",contextKey:null};if(t==="9")return {verdict:"incorrect",ok:false,errorCode:"E07",contextKey:null};return {verdict:"incorrect",ok:false,errorCode:"E04",contextKey:null};}},
    stage5Remedial:{questionId:"M1-02-S5-REMEDIAL",dimension:"應用能力",contextNote:"情境轉換：明確區分「組數」與「人數」（每組 4 人；現有 3 組共 12 人，新增 6^0 = 1 組有 4 人）",prompt:"【個人化補救題】社團活動中，每組有 4 人。目前已有 3 組（共 12 人），另外成立 1 個新小組，其組數以 6^0（等於 1 組，該組有 4 人）表示。請問目前共有幾「組」（3 + 6^0）？",expectedAnswer:"4",validate:function(v){var t=String(v||"").trim();if(!t)return {verdict:"unclear",ok:false,errorCode:"E06",supplementPrompt:"請輸入總組數。"};if(!/^[\+\-]?\d+$/.test(t))return {verdict:"unclear",ok:false,errorCode:"E05",supplementPrompt:"請輸入整數組數。"};if(t==="4")return {verdict:"pass",ok:true,errorCode:null};if(t==="16"||t==="12")return {verdict:"incorrect",ok:false,errorCode:"E06",contextKey:null};if(t==="3")return {verdict:"incorrect",ok:false,errorCode:"E01",contextKey:null};return {verdict:"incorrect",ok:false,errorCode:"E04",contextKey:null};}},
    hints:{H1:"先提醒自己：底數不為 0 時，零次方的結果是 1；同時看清楚題目問的是「組數」還是「人數」。",H2:"把「現有組數」與「新增組數」分開看，不要和每組人數混在一起。",H3:"先算 6^0 = 1（代表 1 組），再把原本的 3 組加上這 1 組。",H4:"完整解析：6^0 = 1，總組數為 3 + 1 = 4 組（若算總人數則是 4 組 × 4 人 = 16 人）。"}
  }
};

var Repo={
  loadAll:function(){try{var r=localStorage.getItem(STORE_KEY);var p=r?JSON.parse(r):{};return p&&typeof p==="object"?p:{};}catch(e){return {};}},
  saveAll:function(m){try{localStorage.setItem(STORE_KEY,JSON.stringify(m));}catch(e){}},
  getNodeSession:function(sid,nid){var all=this.loadAll();var k=(sid||"guest")+"::"+nid;return all[k]||{studentId:sid||"guest",nodeId:nid,currentStage:1,unlockedStage:1,hintLevelIndex:0,remedialPassed:false,lastFeedback:"",lastFeedbackType:"guide",logs:[]};},
  saveNodeSession:function(s){var all=this.loadAll();var k=(s.studentId||"guest")+"::"+s.nodeId;all[k]=s;this.saveAll(all);},
  appendAnswerLog:function(sid,nid,lg){var s=this.getNodeSession(sid,nid);s.logs.push(lg);if(lg.isRemedial&&lg.isCorrect)s.remedialPassed=true;this.saveNodeSession(s);return s;}
};

function getNextHintLevel(session){
  var order=["H1","H2","H3","H4"];
  var idx=typeof session.hintLevelIndex==="number"?session.hintLevelIndex:0;
  var safe=Math.max(0,Math.min(idx,order.length-1));
  session.hintLevelIndex=Math.min(safe+1,order.length-1);
  return order[safe];
}

function evaluateFiveDimensions(logs,remedialPassed){
  var list=Array.isArray(logs)?logs:[];
  var minQ=EXP.minQ;
  var dimsOrder=["概念理解","基礎運算","推理能力","應用能力","獨立完成程度"];
  var qCount={};
  var dimDistinct={概念理解:{},基礎運算:{},推理能力:{},應用能力:{}};
  var dimFirst={概念理解:[],基礎運算:[],推理能力:[],應用能力:[]};
  var allDistinct={};
  var fTotal=0,fOk=0,rTotal=0,rOk=0,maxH=0;

  list.forEach(function(item){
    var qid=item.questionId||"UNKNOWN";
    qCount[qid]=(qCount[qid]||0)+1;
    var isFirst=qCount[qid]===1;
    allDistinct[qid]=true;
    if(isFirst){fTotal+=1;if(item.isCorrect)fOk+=1;}else{rTotal+=1;if(item.isCorrect)rOk+=1;}
    if(item.hintLevel){var hn=parseInt(String(item.hintLevel).replace("H",""),10)||0;if(hn>maxH)maxH=hn;}
    if(item.dimension&&dimDistinct[item.dimension]){
      dimDistinct[item.dimension][qid]=true;
      if(isFirst)dimFirst[item.dimension].push(Boolean(item.isCorrect));
    }
  });

  var out={};
  var qual=0,mast=0;
  ["概念理解","基礎運算","推理能力","應用能力"].forEach(function(d){
    var dc=Object.keys(dimDistinct[d]).length;
    var fa=dimFirst[d];
    if(dc<minQ){
      out[d]={state:"尚需更多練習",detail:"不同題目 "+dc+"/"+minQ+" 題（重複同題不計入）"};
    }else{
      qual+=1;
      var okN=fa.filter(function(x){return x;}).length;
      var ratio=fa.length>0?okN/fa.length:0;
      var st=ratio>=EXP.masteryRatio?"精熟":(ratio>=EXP.progressRatio?"穩定進步":"需要加強");
      if(st==="精熟")mast+=1;
      out[d]={state:st,detail:"首次正確 "+okN+"/"+fa.length+"（不同題 "+dc+" 題）"};
    }
  });

  var allN=Object.keys(allDistinct).length;
  if(allN<minQ||fTotal<minQ){
    out["獨立完成程度"]={state:"尚需更多練習",detail:"不同題目 "+allN+"/"+minQ+" 題｜補救證據："+(remedialPassed?"已通過":"未通過或未作答")};
  }else{
    qual+=1;
    var rAll=fTotal>0?fOk/fTotal:0;
    var indSt=(rAll>=EXP.masteryRatio&&maxH<=2)?"精熟":((rAll>=EXP.progressRatio||rOk>0)?"穩定進步":"需要加強");
    if(indSt==="精熟")mast+=1;
    out["獨立完成程度"]={state:indSt,detail:"首次正確 "+fOk+"/"+fTotal+"｜最高提示 H"+maxH+"｜補救證據："+(remedialPassed?"已通過":"未通過或未作答")};
  }

  var overall="尚需更多練習";
  if(qual<2||allN<minQ)overall="尚需更多練習";
  else if(mast>=3&&maxH<=2)overall="精熟";
  else if(fOk>=1||rOk>0)overall="穩定進步";
  else overall="需要加強";

  return {
    overallStatus:overall,
    dimensionsOrder:dimsOrder,
    dimensions:out,
    summaryLine:"實驗參數｜不同題目數："+allN+"｜首次正確："+fOk+"/"+fTotal+"｜重複練習："+rOk+"/"+rTotal+"｜補救證據："+(remedialPassed?"已通過":"未通過或未作答"),
    params:EXP
  };
}

var engState={selectedNodeId:"M1-01"};

function getSid(){
  var el=document.getElementById("stuInp");
  var d=el&&el.value?el.value.trim():"";
  var s=(localStorage.getItem("edu_stu")||"").trim();
  return d||s||"訪客學員";
}

function advanceToStage2(sid,nid){
  var s=Repo.getNodeSession(sid,nid);
  s.unlockedStage=Math.max(s.unlockedStage,2);
  s.currentStage=2;
  s.lastFeedback="已進入「引導問題」。階段 1 教材已鎖定，不再返回教材，請依提示思考後作答。";
  s.lastFeedbackType="ok";
  Repo.saveNodeSession(s);
}

function handleStageSubmit(sid,nid,ans){
  var node=NODES[nid];
  var s=Repo.getNodeSession(sid,nid);
  var st=s.currentStage;
  var spec=st===2?node.stage2Guide:(st===3?node.stage3Check:(st===4?node.stage4Practice:(st===5?node.stage5Remedial:null)));
  if(!spec)return;
  var isRem=st===5;
  var res=spec.validate(ans,nid);
  var prior=s.logs.filter(function(x){return x.questionId===spec.questionId;}).length;
  var isFirst=prior===0;

  if(res.verdict==="unclear"||res.verdict==="partial"){
    Repo.appendAnswerLog(sid,nid,{
      knowledgeNode:node.code,questionId:spec.questionId,dimension:spec.dimension,
      studentAnswer:ans,expectedAnswer:spec.expectedAnswer||spec.expectedAnswerDesc||"",
      isCorrect:false,verdict:res.verdict,errorCode:res.errorCode||"E05",errorLabel:ERR[res.errorCode||"E05"],
      hintLevel:null,isFirstTry:isFirst,completedAt:new Date().toISOString(),isRemedial:isRem,remedialPassed:false
    });
    s=Repo.getNodeSession(sid,nid);
    s.lastFeedback=(res.verdict==="partial"?"【觀念部分正確，請再補充】":"【需要補充說明】")+(res.supplementPrompt||"請再補充說明。");
    s.lastFeedbackType="guide";
    Repo.saveNodeSession(s);
    return;
  }

  var hLv=null;
  if(!res.ok)hLv=getNextHintLevel(s);
  var rem=!res.ok?fixGuide(res.errorCode,ans,nid,res.contextKey):null;

  s=Repo.appendAnswerLog(sid,nid,{
    knowledgeNode:node.code,questionId:spec.questionId,dimension:spec.dimension,
    studentAnswer:ans,expectedAnswer:spec.expectedAnswer||spec.expectedAnswerDesc||"",
    isCorrect:Boolean(res.ok),verdict:res.ok?"pass":(res.verdict||"incorrect"),
    errorCode:res.ok?null:res.errorCode,errorLabel:res.ok?null:ERR[res.errorCode],
    hintLevel:hLv,isFirstTry:isFirst,completedAt:new Date().toISOString(),isRemedial:isRem,remedialPassed:isRem?Boolean(res.ok):false
  });

  if(res.ok){
    s.hintLevelIndex=0;
    if(st===2){s.currentStage=3;s.unlockedStage=Math.max(s.unlockedStage,3);s.lastFeedback="觀念引導清楚！現在進入「理解檢查」。";s.lastFeedbackType="ok";}
    else if(st===3){s.currentStage=4;s.unlockedStage=Math.max(s.unlockedStage,4);s.lastFeedback="理解檢查通過！接著進入「互動練習」。";s.lastFeedbackType="ok";}
    else if(st===4){s.currentStage=5;s.unlockedStage=Math.max(s.unlockedStage,5);s.lastFeedback="互動練習完成！接下來進入「個人化補救」，以不同情境檢驗相同觀念。";s.lastFeedbackType="ok";}
    else if(st===5){s.remedialPassed=true;s.currentStage=6;s.unlockedStage=Math.max(s.unlockedStage,6);s.lastFeedback="補救題也完成！現在進入「學習總結」。";s.lastFeedbackType="ok";}
    Repo.saveNodeSession(s);
  }else{
    var ht=node.hints[hLv]||node.hints.H1;
    s.lastFeedback=rem.ok1+"\n"+rem.ok2+"\n【"+hLv+" 提示】"+ht;
    s.lastFeedbackType="guide";
    Repo.saveNodeSession(s);
  }
}

function esc(x){
  return String(x||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function renderStageBody(node,s,mEval){
  var st=s.currentStage;
  if(st===1){
    return "<h4 class=\"te-card-title\">階段 1：教材學習</h4><div class=\"te-sub-box\">"+esc(node.stage1Material)+"</div><div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-to-stage2\">完成教材，進入階段 2（引導問題）</button></div>";
  }
  if(st>=2&&st<=5){
    var q=st===2?node.stage2Guide:(st===3?node.stage3Check:(st===4?node.stage4Practice:node.stage5Remedial));
    var t=st===2?"階段 2：引導問題（教材已鎖定，不返回階段 1）":(st===3?"階段 3：理解檢查":(st===4?"階段 4：互動練習":"階段 5：個人化補救（不同情境檢驗相同觀念）"));
    return "<h4 class=\"te-card-title\">"+esc(t)+"</h4>"+(st===5&&q.contextNote?"<div class=\"te-sub-box\">"+esc(q.contextNote)+"</div>":"")+"<p class=\"te-text\">"+esc(q.prompt)+"</p><input type=\"text\" class=\"te-input\" id=\"te-ans-input\" placeholder=\"請輸入你的想法或答案\" /><div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-submit-ans\">送出作答</button></div>";
  }
  var dimsHtml=mEval.dimensionsOrder.map(function(d){
    var o=mEval.dimensions[d];
    return "<div class=\"te-dim-item\"><div class=\"te-dim-name\">"+esc(d)+"</div><div class=\"te-dim-val\">"+esc(o.state)+"</div><div style=\"font-size:11px;color:#cbd5e1;margin-top:4px;\">"+esc(o.detail)+"</div></div>";
  }).join("");
  var logsHtml=(s.logs&&s.logs.length)?"<div class=\"te-sub-box\"><strong>作答紀錄明細：</strong><ul class=\"te-log-list\">"+s.logs.map(function(lg){
    var stTxt=lg.isCorrect?"正確":((lg.verdict==="unclear"||lg.verdict==="partial")?"需補充說明":"需再釐清");
    return "<li>"+esc(lg.questionId)+"｜"+(lg.isFirstTry?"首次作答":"重複練習")+"｜作答「"+esc(lg.studentAnswer)+"」｜"+stTxt+(lg.hintLevel?"｜提示 "+esc(lg.hintLevel):"")+(lg.isRemedial?"｜補救題":"")+"</li>";
  }).join("")+"</ul></div>":"";
  return "<h4 class=\"te-card-title\">階段 6：學習總結（實驗參數計算・非研究驗證定論）</h4><div class=\"te-sub-box\"><strong>整體狀態：</strong>"+esc(mEval.overallStatus)+"\n"+esc(mEval.summaryLine)+"\n實驗門檻：每維度最低不同題數 "+mEval.params.minQ+" 題、精熟首次正確率≥"+Math.round(mEval.params.masteryRatio*100)+"%。</div><div class=\"te-dim-grid\">"+dimsHtml+"</div>"+logsHtml+"<div class=\"te-actions\"><button type=\"button\" class=\"te-btn secondary\" id=\"te-restart-node\">重新從階段 1 學習此知識點</button></div>";
}

function renderTeachingEngine(container,preferredNodeId){
  if(!container)return;
  if(preferredNodeId&&NODES[preferredNodeId])engState.selectedNodeId=preferredNodeId;
  var sid=getSid();
  var node=NODES[engState.selectedNodeId]||NODES["M1-01"];
  var s=Repo.getNodeSession(sid,node.id);
  var mEval=evaluateFiveDimensions(s.logs,s.remedialPassed);

  var labels=["1. 教材學習","2. 引導問題","3. 理解檢查","4. 互動練習","5. 個人化補救","6. 學習總結"];
  var strip=labels.map(function(lb,i){
    var n=i+1;
    var c="te-stage-step"+(s.currentStage===n?" active":(n<s.currentStage?" done":""))+((n>s.unlockedStage||(s.currentStage>=2&&n===1))?" locked":"");
    return "<div class=\""+c+"\">"+(s.currentStage>=2&&n===1?"🔒 ":"")+esc(lb)+"</div>";
  }).join("");

  var tabs=Object.keys(NODES).map(function(k){
    var it=NODES[k];
    return "<button type=\"button\" class=\"te-topic-btn"+(it.id===node.id?" active":"")+"\" data-te-node=\""+esc(it.id)+"\">"+esc(it.title)

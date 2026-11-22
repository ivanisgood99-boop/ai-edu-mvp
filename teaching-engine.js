/* 第二階段：學生端教學引擎（課程名稱對照、六階段流程、直線與圓、星球星級精熟度） */
(function () {
  "use strict";

  var EXP = {
    minQ: 1,
    minOverallQ: 3,
    minStarQ: 2,
    masteryRatio: 0.75,
    progressRatio: 0.45,
    maxHintNum: 2
  };

  var ERR = {
    E01: "定義理解錯誤",
    E02: "性質使用錯誤",
    E03: "忽略適用條件",
    E04: "運算錯誤",
    E05: "推論錯誤",
    E06: "題意理解或建模錯誤",
    E07: "抄寫或計算疏失"
  };

  var COURSE_NAMES = {
    "M1-01": { code: "M1-01", studentTitle: "正整數次方", group: "指數觀念" },
    "M1-02": { code: "M1-02", studentTitle: "零次方", group: "指數觀念" },
    "M1-03": { code: "M1-03", studentTitle: "負整數次方", group: "指數觀念" },
    "LC-01": { code: "LC-01", studentTitle: "坐標平面與點的關係", group: "直線與圓" },
    "LC-02": { code: "LC-02", studentTitle: "直線的斜率與傾斜程度", group: "直線與圓" },
    "LC-03": { code: "LC-03", studentTitle: "直線方程式的建立與判讀", group: "直線與圓" },
    "LC-04": { code: "LC-04", studentTitle: "圓的方程式與圓心半徑", group: "直線與圓" },
    "LC-05": { code: "LC-05", studentTitle: "直線與圓的位置關係", group: "直線與圓" },
    "LC-06": { code: "LC-06", studentTitle: "直線與圓的綜合應用", group: "直線與圓" },
    "LC-ASSESS": { code: "LC-ASSESS", studentTitle: "直線與圓星球綜合評量", group: "直線與圓" }
  };

  function getStudentTitle(id) {
    return COURSE_NAMES[id] ? COURSE_NAMES[id].studentTitle : "學習單元";
  }

  function getTeacherLabel(id) {
    var item = COURSE_NAMES[id];
    if (!item) return String(id || "");
    return item.studentTitle + "（" + item.code + "）";
  }

  var STORE_KEY = "ai_edu_phase2_records_v4";

  function resObj(verdict, ok, errorCode, extra) {
    var ex = extra || {};
    return {
      verdict: verdict,
      ok: Boolean(ok),
      errorCode: ok ? null : (errorCode || "E05"),
      contextKey: ex.contextKey || null,
      supplementPrompt: ex.supplementPrompt || null
    };
  }

  function fixGuide(code, ans, nodeId, ctx) {
    var a = String(ans || "").trim();
    if (ctx === "contradiction_sign") {
      return {
        ok1: "這句說法把正負號的奇偶規律寫反了，我們一起重新對照乘方的符號規則。",
        ok2: "底數為負數時，偶數次方相乘為正數；奇數次方相乘為負數。"
      };
    }
    if (ctx === "zero_power_includes_zero") {
      return {
        ok1: "提到零次方為 1 有抓到部分概念，但「包括 0」需要修正。",
        ok2: "零指數的前提是「底數不能為 0」；0 的 0 次方不在一般規定內。"
      };
    }
    if (ctx === "division_without_nonzero_rule") {
      return {
        ok1: "你提到相除與 1 的關聯，但還需要把「同底數相除指數相減」與「底數不可為 0」串起來。",
        ok2: "非零底數 a 滿足 a^n ÷ a^n = a^(n-n) = a^0 = 1，前提是底數不能為 0。"
      };
    }
    if (code === "E01") {
      if (nodeId === "M1-01" && (a.indexOf("6") !== -1 || a.indexOf("15") !== -1 || a.indexOf("×") !== -1)) {
        return { ok1: "次方是「相同底數連續相乘」，不是直接乘以次數。", ok2: "先把底數寫出來連乘看看，例如 2^3 是 2 × 2 × 2 = 8。" };
      }
      if (nodeId === "M1-02" && a === "0") {
        return { ok1: "看到 0 次方想到 0 是常見直覺，但非零數的 0 次方結果是 1。", ok2: "想想同一個非零數自己除自己（如 5^2 ÷ 5^2）的規律。" };
      }
      return { ok1: "我們先回到這個觀念的定義，看看題目問的是哪一種關係。", ok2: "先辨識題目條件與對應的幾何或代數定義。" };
    }
    if (code === "E02") return { ok1: "性質或括號／符號的運用有一點偏差，先看清楚作用對象。", ok2: "仔細檢查括號、正負號或公式條件是否套用正確。" };
    if (code === "E03") return { ok1: "方向接近了，但這題還要特別留意「適用條件或限制」。", ok2: "先確認分母、底數或半徑／距離是否符合成立條件。" };
    if (code === "E04") return { ok1: "觀念方向不錯，計算過程中在正負號或數字運算遇到小阻礙。", ok2: "把每一步的數值與正負號分開算清楚，再做加減或乘除。" };
    if (code === "E05") return { ok1: "推論過程還缺少完整的連結，我們把理由說得更清楚一些。", ok2: "試著用「因為……所以……」說出你的推論依據。" };
    if (code === "E06") return { ok1: "題目條件與作答還沒完全對齊，先看清楚題目問的是什麼。", ok2: "先找出題目給的條件與最後要回答的對象。" };
    return { ok1: "可能是看題或抄寫時漏看符號或數字，放慢腳步再檢查一次。", ok2: "對照題目上的數字與正負號，逐一確認後再送出。" };
  }
  var SemanticHook = {
    customAnalyzer: null,
    analyzeExplanation: function (p) {
      if (typeof this.customAnalyzer === "function") {
        var c = this.customAnalyzer(p);
        if (c && typeof c.verdict === "string") return resObj(c.verdict, c.verdict === "pass", c.errorCode, c);
      }
      var raw = String((p && p.answer) || "").trim();
      var low = raw.toLowerCase();
      if (!raw || raw.length <= 1 || /^[\+\-]?\d+$/.test(raw)) {
        return resObj("unclear", false, "E05", { supplementPrompt: "只寫單一字詞或數字還看不出你的推理，請用完整句子說明理由。" });
      }
      if (p.nodeId === "M1-01") {
        var badOdd = (low.indexOf("奇數") !== -1 && low.indexOf("正") !== -1 && low.indexOf("奇數次方是負") === -1 && low.indexOf("奇數次方為負") === -1 && low.indexOf("奇數次方負") === -1) || (low.indexOf("(-2)^3") !== -1 && low.indexOf("正") !== -1 && low.indexOf("負") === -1);
        var badEven = (low.indexOf("偶數") !== -1 && low.indexOf("負") !== -1 && low.indexOf("偶數次方是正") === -1 && low.indexOf("偶數次方為正") === -1 && low.indexOf("偶數次方正") === -1) || (low.indexOf("(-2)^4") !== -1 && low.indexOf("負") !== -1 && low.indexOf("正") === -1);
        if (badOdd || badEven || (low.indexOf("奇數為正") !== -1 && low.indexOf("偶數為正") !== -1)) {
          return resObj("incorrect", false, "E02", { contextKey: "contradiction_sign" });
        }
        var oddNeg = (low.indexOf("奇") !== -1 && low.indexOf("負") !== -1) || low.indexOf("-8") !== -1;
        var evenPos = (low.indexOf("偶") !== -1 && low.indexOf("正") !== -1) || low.indexOf("16") !== -1;
        var bracket = low.indexOf("括號") !== -1 || low.indexOf("連乘") !== -1 || low.indexOf("底數") !== -1;
        if (oddNeg && evenPos) return resObj("pass", true, null);
        if (oddNeg || evenPos || bracket) {
          return resObj("partial", false, "E05", { supplementPrompt: "你的說明還不夠完整，請補充說明奇數次方與偶數次方各自的正負號規律與括號影響。" });
        }
        return resObj("unclear", false, "E01", { supplementPrompt: "這段說明還看不出與負數次方正負號規律的關聯，請用自己的話補充說明。" });
      }
      if (p.nodeId === "M1-02") {
        var incZero = low.indexOf("包括 0") !== -1 || low.indexOf("包括0") !== -1 || low.indexOf("包含 0") !== -1 || low.indexOf("包含0") !== -1 || low.indexOf("0 的 0 次方") !== -1 || low.indexOf("0的0次方") !== -1 || (low.indexOf("任何數") !== -1 && low.indexOf("0") !== -1 && low.indexOf("不") === -1 && low.indexOf("≠") === -1 && low.indexOf("除") === -1);
        if (incZero && (low.indexOf("零次方") !== -1 || low.indexOf("0 次方") !== -1 || low.indexOf("0次方") !== -1)) {
          return resObj("incorrect", false, "E03", { contextKey: "zero_power_includes_zero" });
        }
        var hasDiv = low.indexOf("除") !== -1 || low.indexOf("相減") !== -1 || low.indexOf("自己") !== -1 || low.indexOf("相同") !== -1;
        var hasOne = low.indexOf("1") !== -1 || low.indexOf("一") !== -1;
        var hasNonZero = low.indexOf("不為 0") !== -1 || low.indexOf("不為0") !== -1 || low.indexOf("非零") !== -1 || low.indexOf("≠") !== -1 || low.indexOf("不能為 0") !== -1 || low.indexOf("不能為0") !== -1;
        if (hasDiv && hasOne && hasNonZero) return resObj("pass", true, null);
        if (hasDiv && hasOne && !hasNonZero) {
          return resObj("partial", false, "E03", { contextKey: "division_without_nonzero_rule", supplementPrompt: "你提到相除與 1 的關係，請再補充說明「底數不能為 0」這個條件。" });
        }
        if (hasDiv || hasOne || hasNonZero) {
          return resObj("partial", false, "E05", { supplementPrompt: "你抓到部分線索了，請再補充「相同非零數相除為 1」或「同底數相除指數相減」的完整理由。" });
        }
        return resObj("unclear", false, "E01", { supplementPrompt: "這段說明還沒有清楚連結到除法規律或非零底數條件，請再補充說明。" });
      }
      // 直線與圓引導題：要求完整句子與合理推理連結
      var hasReason = raw.length >= 8 && (raw.indexOf("因為") !== -1 || raw.indexOf("所以") !== -1 || raw.indexOf("平方") !== -1 || raw.indexOf("斜率") !== -1 || raw.indexOf("半徑") !== -1 || raw.indexOf("距離") !== -1 || raw.indexOf("圓心") !== -1 || raw.indexOf("交點") !== -1 || raw.indexOf("正") !== -1 || raw.indexOf("負") !== -1 || raw.indexOf("0") !== -1 || raw.indexOf("相等") !== -1);
      if (hasReason) return resObj("pass", true, null);
      if (raw.length >= 4) {
        return resObj("partial", false, "E05", { supplementPrompt: "你已寫出初步想法，請再補充說明「為什麼」或對應的幾何／代數依據。" });
      }
      return resObj("unclear", false, "E05", { supplementPrompt: "請用完整句子寫出你的推理理由，不要只填簡短字詞。" });
    }
  };

  function makeIntValidator(expectedStr, altWrongList, altWrongCode) {
    return function (v) {
      var t = String(v || "").trim();
      if (!t) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入計算結果。" });
      if (!/^[\+\-]?\d+$/.test(t)) return resObj("unclear", false, "E05", { supplementPrompt: "請輸入整數數值。" });
      if (t === expectedStr) return resObj("pass", true, null);
      if (altWrongList && altWrongList.indexOf(t) !== -1) return resObj("incorrect", false, altWrongCode || "E02");
      return resObj("incorrect", false, "E04");
    };
  }

  var NODES = {
    "M1-01": {
      id: "M1-01", code: "M1-01", title: "正整數次方", isAssessment: false,
      stage1Material: "【原創重點整理｜正整數次方】\n1. 定義：底數 a 連續相乘 n 次（n 為正整數）記為 a^n。\n2. 正例：2^3 = 2 × 2 × 2 = 8；(-3)^2 = (-3) × (-3) = 9。\n3. 提醒：2^3 不是 2 × 3 = 6；-3^2 代表 -(3 × 3) = -9，與 (-3)^2 括號範圍不同。",
      stage2Guide: { questionId: "M1-01-S2", dimension: "推理能力", prompt: "想一想：當底數是負數時，次方次數是奇數或偶數，結果的正負號有什麼不同？請用自己的話說明為什麼 (-2)^3 與 (-2)^4 的正負號不同。", expectedAnswerDesc: "說明奇數次方為負、偶數次方為正，且無矛盾陳述", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "M1-01-S3", dimension: "概念理解", prompt: "【理解檢查】下列哪一個算式的值與 -5^2 相等？（請輸入 A、B 或 C）\nA. (-5)^2\nB. -(5 × 5)\nC. (-5) × 2", expectedAnswer: "B", validate: function (v) { var u = String(v || "").trim().toUpperCase(); if (!u) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入選項 A、B 或 C。" }); if (u === "B") return resObj("pass", true, null); if (u === "A") return resObj("incorrect", false, "E02", { contextKey: "contradiction_sign" }); if (u === "C") return resObj("incorrect", false, "E01"); return resObj("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C 其中一個選項。" }); } },
      stage4Practice: { questionId: "M1-01-S4", dimension: "基礎運算", prompt: "【互動練習】請計算 2^3 + (-3)^2 的值是多少？", expectedAnswer: "17", validate: makeIntValidator("17", ["-1", "1", "-17"], "E02") },
      stage5Remedial: { questionId: "M1-01-S5", dimension: "應用能力", contextNote: "情境轉換：正方形地墊面積（2^2 = 4）與負數三次方（(-2)^3 = -8）合併計算", prompt: "【個人化補救題】一塊邊長為 2 公尺的正方形地墊，面積為 2^2 = 4 平方公尺；另有 (-2)^3（表示 (-2) 連乘 3 次）。請問「正方形面積（4）」加上「(-2)^3 的值」是多少？（例如 -4）", expectedAnswer: "-4", validate: makeIntValidator("-4", ["12", "4"], "E02") },
      hints: { H1: "先回想次方代表「連續相乘的次數」，並留意括號有沒有把負號包進去。", H2: "先分別看清楚每一項的底數與次方，再決定正負號與數值。", H3: "先算個別次方值（例如 2^2 = 4，(-2)^3 = -8），再依題意相加。", H4: "完整解析：2^2 = 4，(-2)^3 = -8，4 + (-8) = -4。" }
    },
    "M1-02": {
      id: "M1-02", code: "M1-02", title: "零次方", isAssessment: false,
      stage1Material: "【原創重點整理｜零次方】\n1. 定義：當底數 a ≠ 0 時，a^0 = 1。\n2. 必要條件：底數不可為 0（0^0 不在一般規定內）。\n3. 正例與反例：7^0 = 1、(-6)^0 = 1；但 (x - 3)^0 = 1 時 x 必須 ≠ 3。",
      stage2Guide: { questionId: "M1-02-S2", dimension: "推理能力", prompt: "想一想：如果同底數相除時指數相減，例如 5^2 ÷ 5^2 會得到 5^0；從除法規律來看，為什麼非零數的 0 次方會規定為 1，而不是 0？請用自己的話說明（並留意底數限制）。", expectedAnswerDesc: "說明同底數相除／非零數相除為 1，且底數不可為 0", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "M1-02-S3", dimension: "概念理解", prompt: "【理解檢查】若 (x - 3)^0 = 1 成立，x 必須滿足什麼條件？（請輸入 A、B 或 C）\nA. x 可以是任意實數\nB. x ≠ 3\nC. x > 3", expectedAnswer: "B", validate: function (v) { var u = String(v || "").trim().toUpperCase(); if (!u) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入選項 A、B 或 C。" }); if (u === "B") return resObj("pass", true, null); if (u === "A") return resObj("incorrect", false, "E03", { contextKey: "zero_power_includes_zero" }); if (u === "C") return resObj("incorrect", false, "E07"); return resObj("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C 其中一個選項。" }); } },
      stage4Practice: { questionId: "M1-02-S4", dimension: "基礎運算", prompt: "【互動練習】請計算 (-6)^0 + 2^3 - 5^0 的值是多少？", expectedAnswer: "8", validate: makeIntValidator("8", ["7", "2", "0"], "E01") },
      stage5Remedial: { questionId: "M1-02-S5", dimension: "應用能力", contextNote: "情境轉換：明確區分「組數」與「人數」（每組 4 人；現有 3 組共 12 人，新增 6^0 = 1 組有 4 人）", prompt: "【個人化補救題】社團活動中，每組有 4 人。目前已有 3 組（共 12 人），另外成立 1 個新小組，其組數以 6^0（等於 1 組，該組有 4 人）表示。請問目前共有幾「組」（3 + 6^0）？", expectedAnswer: "4", validate: makeIntValidator("4", ["16", "12"], "E06") },
      hints: { H1: "先提醒自己：底數不為 0 時，零次方的結果是 1；同時看清楚題目問的是「組數」還是「人數」。", H2: "把「現有組數」與「新增組數」分開看，不要和每組人數混在一起。", H3: "先算 6^0 = 1（代表 1 組），再把原本的 3 組加上這 1 組。", H4: "完整解析：6^0 = 1，總組數為 3 + 1 = 4 組（若算總人數則是 4 組 × 4 人 = 16 人）。" }
    }
  };
  var EXTRA_NODES = {
    "LC-01": {
      id: "LC-01", code: "LC-01", title: "坐標平面與點的關係", isAssessment: false,
      stage1Material: "【原創教材｜坐標平面與點的關係】\n1. 平面上兩點 A(x1, y1)、B(x2, y2) 的水平差為 |x2 - x1|，鉛直差為 |y2 - y1|。\n2. 兩點距離公式：AB = √[(x2 - x1)² + (y2 - y1)²]。\n3. 原創例題：點 (1, 2) 與 (4, 6) 距離為 √(3² + 4²) = 5。",
      stage2Guide: { questionId: "LC-01-S2", dimension: "推理能力", prompt: "請說明：為什麼兩點距離公式中把 x 坐標差與 y 坐標差都先平方，結果不會出現負數？", expectedAnswerDesc: "說明實數平方非負", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-01-S3", dimension: "概念理解", prompt: "【理解檢查】若兩點水平距離為 6、鉛直距離為 8，兩點連線段長為多少？（輸入整數）", expectedAnswer: "10", validate: makeIntValidator("10", ["14", "2"], "E01") },
      stage4Practice: { questionId: "LC-01-S4", dimension: "基礎運算", prompt: "【互動練習】計算點 (-2, 1) 與點 (2, 4) 之間的距離。（輸入整數）", expectedAnswer: "5", validate: makeIntValidator("5", ["7", "1"], "E04") },
      stage5Remedial: { questionId: "LC-01-S5", dimension: "應用能力", contextNote: "情境轉換：直角航線位移距離計算", prompt: "【個人化補救題】巡檢機器人從原點 (0, 0) 向東移動 12 單位，再向北移動 5 單位，起終點直線距離為多少單位？（輸入整數）", expectedAnswer: "13", validate: makeIntValidator("13", ["17", "7"], "E04") },
      hints: { H1: "先找水平變化量與鉛直變化量。", H2: "套用畢氏定理：距離² = 水平差² + 鉛直差²。", H3: "12² + 5² = 144 + 25 = 169。", H4: "完整解析：√169 = 13。" }
    },
    "LC-02": {
      id: "LC-02", code: "LC-02", title: "直線的斜率與傾斜程度", isAssessment: false,
      stage1Material: "【原創教材｜直線的斜率】\n1. 當 x1 ≠ x2 時，通過 A(x1, y1)、B(x2, y2) 的斜率 m = (y2 - y1) / (x2 - x1)。\n2. 斜率為正代表由左向右下上升；斜率為負代表由左向右下降；水平線斜率為 0。\n3. 原創例題：過 (1, 3) 與 (3, 7) 的直線斜率為 (7 - 3)/(3 - 1) = 2。",
      stage2Guide: { questionId: "LC-02-S2", dimension: "推理能力", prompt: "請說明：當直線由左向右往上攀升時，為什麼斜率會是正數？", expectedAnswerDesc: "x 增大且 y 增大，同號相除為正", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-02-S3", dimension: "概念理解", prompt: "【理解檢查】水平線上任兩點 y 坐標相同，它的斜率是多少？（輸入整數）", expectedAnswer: "0", validate: makeIntValidator("0", ["1"], "E01") },
      stage4Practice: { questionId: "LC-02-S4", dimension: "基礎運算", prompt: "【互動練習】求通過點 (2, 5) 與點 (6, -3) 的直線斜率。（輸入整數）", expectedAnswer: "-2", validate: makeIntValidator("-2", ["2", "-8"], "E04") },
      stage5Remedial: { questionId: "LC-02-S5", dimension: "應用能力", contextNote: "情境轉換：坡道高度與水平距離比值", prompt: "【個人化補救題】步道起點水平 0、高度 1，走到水平 4 時高度為 9，此段平均斜率為多少？（輸入整數）", expectedAnswer: "2", validate: makeIntValidator("2", ["8", "4"], "E04") },
      hints: { H1: "斜率是 y 變化量除以 x 變化量。", H2: "注意分子與分母減法順序要一致。", H3: "(-3 - 5) / (6 - 2) = -8 / 4。", H4: "完整解析：斜率為 -2。" }
    },
    "LC-03": {
      id: "LC-03", code: "LC-03", title: "直線方程式的建立與判讀", isAssessment: false,
      stage1Material: "【原創教材｜直線方程式】\n1. 已知斜率 m 與一點 (x0, y0)，點斜式為 y - y0 = m(x - x0)。\n2. 判讀點是否在直線上，可將點坐標代入方程式檢驗左右是否相等。\n3. 原創例題：斜率 2 且過 (0, 1) 的直線為 y = 2x + 1，代入 x = 3 得 y = 7。",
      stage2Guide: { questionId: "LC-03-S2", dimension: "推理能力", prompt: "請說明：如何判斷一個已知點 (a, b) 是否落在某條直線方程式上？", expectedAnswerDesc: "將 x=a, y=b 代入方程式檢驗等式是否成立", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-03-S3", dimension: "概念理解", prompt: "【理解檢查】直線 y = 3x - 2 中，當 x = 0 時 y 的值是多少？（輸入整數）", expectedAnswer: "-2", validate: makeIntValidator("-2", ["2", "3"], "E01") },
      stage4Practice: { questionId: "LC-03-S4", dimension: "基礎運算", prompt: "【互動練習】若直線方程式為 y = 2x + 3，當 x = 4 時 y 的值是多少？（輸入整數）", expectedAnswer: "11", validate: makeIntValidator("11", ["9", "14"], "E04") },
      stage5Remedial: { questionId: "LC-03-S5", dimension: "應用能力", contextNote: "情境轉換：計程車／租車線性費用公式", prompt: "【個人化補救題】某設備租用費率為「基本費 20 元加上每小時 15 元」，使用 2 小時的總費用是多少元？（輸入整數）", expectedAnswer: "50", validate: makeIntValidator("50", ["35", "30"], "E06") },
      hints: { H1: "把題目給的數值代入對應變數。", H2: "先算乘法項，再做加法。", H3: "20 + 15 × 2 = 20 + 30。", H4: "完整解析：總費用為 50 元。" }
    },
    "LC-04": {
      id: "LC-04", code: "LC-04", title: "圓的方程式與圓心半徑", isAssessment: false,
      stage1Material: "【原創教材｜圓的方程式】\n1. 圓心 (h, k)、半徑 r（r > 0）的圓標準式為 (x - h)² + (y - k)² = r²。\n2. 圓上任一點到圓心的距離都等於半徑 r。\n3. 原創例題：(x - 1)² + (y + 2)² = 9 的圓心為 (1, -2)，半徑為 3。",
      stage2Guide: { questionId: "LC-04-S2", dimension: "推理能力", prompt: "請說明：為什麼圓的標準式右邊是 r² 而不是 r，且為什麼 r 必須大於 0？", expectedAnswerDesc: "由距離公式平方而來，半徑長度需為正數", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-04-S3", dimension: "概念理解", prompt: "【理解檢查】圓方程式 (x - 2)² + (y - 5)² = 16 的半徑 r 是多少？（輸入整數）", expectedAnswer: "4", validate: makeIntValidator("4", ["16", "8"], "E02") },
      stage4Practice: { questionId: "LC-04-S4", dimension: "基礎運算", prompt: "【互動練習】若圓心為 (0, 0)、半徑為 5，則 r² 的值是多少？（輸入整數）", expectedAnswer: "25", validate: makeIntValidator("25", ["10", "5"], "E04") },
      stage5Remedial: { questionId: "LC-04-S5", dimension: "應用能力", contextNote: "情境轉換：基地台訊號圓形範圍半徑平方", prompt: "【個人化補救題】某訊號基地台半徑為 7 公里，在圓方程式標準式中右邊常數 r² 為多少？（輸入整數）", expectedAnswer: "49", validate: makeIntValidator("49", ["14", "7"], "E04") },
      hints: { H1: "標準式右邊是半徑的平方。", H2: "7 的平方是 7 × 7。", H3: "7 × 7 = 49。", H4: "完整解析：r² = 49。" }
    },
    "LC-05": {
      id: "LC-05", code: "LC-05", title: "直線與圓的位置關係", isAssessment: false,
      stage1Material: "【原創教材｜直線與圓的位置關係】\n1. 設圓心到直線距離為 d，圓半徑為 r。\n2. d < r 時相交於兩點；d = r 時相切於一點；d > r 時不相交。\n3. 原創例題：半徑 r = 5，若圓心到直線距離 d = 5，兩者位置關係為相切（交點數 1）。",
      stage2Guide: { questionId: "LC-05-S2", dimension: "推理能力", prompt: "請說明：當圓心到直線的距離 d 大於半徑 r 時，為什麼直線與圓沒有交點？", expectedAnswerDesc: "圓上各點到圓心距離等於 r，小於 d 故無交點", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-05-S3", dimension: "概念理解", prompt: "【理解檢查】若圓半徑 r = 6，圓心到直線距離 d = 6，直線與圓有幾個交點？（輸入整數）", expectedAnswer: "1", validate: makeIntValidator("1", ["2", "0"], "E01") },
      stage4Practice: { questionId: "LC-05-S4", dimension: "基礎運算", prompt: "【互動練習】若 r = 10、d = 6，求 r - d 的值是多少？（輸入整數）", expectedAnswer: "4", validate: makeIntValidator("4", ["16", "-4"], "E04") },
      stage5Remedial: { questionId: "LC-05-S5", dimension: "應用能力", contextNote: "情境轉換：航道安全距離與警戒半徑差值", prompt: "【個人化補救題】警戒區半徑為 9 公里，船隻航線距中心 4 公里，兩者距離差（9 - 4）為多少公里？（輸入整數）", expectedAnswer: "5", validate: makeIntValidator("5", ["13", "-5"], "E04") },
      hints: { H1: "比較圓心到直線距離 d 與半徑 r。", H2: "相切時 d = r，交點數為 1。", H3: "計算 9 - 4。", H4: "完整解析：9 - 4 = 5。" }
    },
    "LC-06": {
      id: "LC-06", code: "LC-06", title: "直線與圓的綜合應用", isAssessment: false,
      stage1Material: "【原創教材｜直線與圓的綜合應用】\n1. 綜合運用兩點距離、斜率、直線與圓方程式解決幾何與生活問題。\n2. 解題時先畫草圖或列出坐標條件，再選擇合適公式。\n3. 原創例題：圓心 (0, 0) 到點 (3, 4) 距離為 5，若半徑為 5 則該點恰在圓上。",
      stage2Guide: { questionId: "LC-06-S2", dimension: "推理能力", prompt: "請說明：要判斷一個點是在圓內、圓上還是圓外，應該比較哪兩個量？", expectedAnswerDesc: "比較點到圓心的距離與半徑的大小", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-06-S3", dimension: "概念理解", prompt: "【理解檢查】以原點 (0, 0) 為圓心、半徑 5 的圓，點 (3, 4) 到圓心距離為多少？（輸入整數）", expectedAnswer: "5", validate: makeIntValidator("5", ["7", "25"], "E01") },
      stage4Practice: { questionId: "LC-06-S4", dimension: "基礎運算", prompt: "【互動練習】若點到圓心距離平方為 13，半徑平方為 25，兩者差值（25 - 13）為多少？（輸入整數）", expectedAnswer: "12", validate: makeIntValidator("12", ["38", "-12"], "E04") },
      stage5Remedial: { questionId: "LC-06-S5", dimension: "應用能力", contextNote: "情境轉換：景觀摩天輪／旋轉盤幾何定位", prompt: "【個人化補救題】旋轉觀景台半徑 8 公尺，中心在 (0, 0)，若座艙位於 (0, 8)，它與中心的距離是多少公尺？（輸入整數）", expectedAnswer: "8", validate: makeIntValidator("8", ["16", "0"], "E06") },
      hints: { H1: "先看點與中心的坐標差。", H2: "從 (0, 0) 到 (0, 8) 只有鉛直移動。", H3: "|8 - 0| = 8。", H4: "完整解析：距離為 8 公尺。" }
    },
    "LC-ASSESS": {
      id: "LC-ASSESS", code: "LC-ASSESS", title: "直線與圓星球綜合評量", isAssessment: true,
      stage1Material: "【星球綜合評量說明｜直線與圓（2n+1 關卡最終站）】\n本關卡綜合檢驗平面距離、斜率、直線、圓方程式與位置關係。\n完成教材說明後，進入六階段循序檢驗。",
      stage2Guide: { questionId: "LC-ASSESS-S2", dimension: "推理能力", prompt: "請綜合說明：在坐標平面上，直線與圓的位置關係如何透過距離與半徑來判斷？", expectedAnswerDesc: "說明圓心到直線距離 d 與半徑 r 的大小關係", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-ASSESS-S3", dimension: "概念理解", prompt: "【綜合理解】若圓心到直線距離 d 等於半徑 r，兩者位置關係是哪一種？（請輸入 A、B 或 C）\nA. 相切\nB. 交於兩點\nC. 不相交", expectedAnswer: "A", validate: function (v) { var u = String(v || "").trim().toUpperCase(); if (!u) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入 A、B 或 C。" }); if (u === "A") return resObj("pass", true, null); if (u === "B" || u === "C") return resObj("incorrect", false, "E01"); return resObj("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C。" }); } },
      stage4Practice: { questionId: "LC-ASSESS-S4", dimension: "基礎運算", prompt: "【綜合運算】已知兩點 (1, 2) 與 (4, 6) 距離為 5，斜率 (6 - 2) / (4 - 1) 分子為 4、分母為 3，兩者相加（5 + 4 + 3）為多少？（輸入整數）", expectedAnswer: "12", validate: makeIntValidator("12", ["9", "8"], "E04") },
      stage5Remedial: { questionId: "LC-ASSESS-S5", dimension: "應用能力", contextNote: "綜合應用：圓半徑與中心平移合成", prompt: "【綜合補救題】圓半徑為 6，若將圓心水平右移 3 單位，新圓心 x 坐標由 0 變為多少？（輸入整數）", expectedAnswer: "3", validate: makeIntValidator("3", ["6", "9"], "E06") },
      hints: { H1: "回顧 d 與 r 相等時為相切。", H2: "逐題拆解加減運算。", H3: "5 + 4 + 3 = 12。", H4: "完整解析：綜合運算結果為 12。" }
    }
  };

  Object.keys(EXTRA_NODES).forEach(function (k) { NODES[k] = EXTRA_NODES[k]; });
  var Repo = {
    loadAll: function () {
      try { var r = localStorage.getItem(STORE_KEY); var p = r ? JSON.parse(r) : {}; return p && typeof p === "object" ? p : {}; } catch (e) { return {}; }
    },
    saveAll: function (m) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(m)); } catch (e) {}
    },
    getNodeSession: function (sid, nid) {
      var all = this.loadAll();
      var k = (sid || "guest") + "::" + nid;
      return all[k] || {
        studentId: sid || "guest", nodeId: nid, currentStage: 1, unlockedStage: 1,
        hintLevelIndex: 0, remedialPassed: false, starCode: "UNRATED",
        lastFeedback: "", lastFeedbackType: "guide", logs: []
      };
    },
    saveNodeSession: function (s) {
      var all = this.loadAll();
      all[(s.studentId || "guest") + "::" + s.nodeId] = s;
      this.saveAll(all);
    },
    appendAnswerLog: function (sid, nid, lg) {
      var s = this.getNodeSession(sid, nid);
      s.logs.push(lg);
      if (lg.isRemedial && lg.isCorrect) s.remedialPassed = true;
      var starEval = evaluatePlanetStarRating(s.logs, s.starCode, s.remedialPassed);
      s.starCode = starEval.code;
      this.saveNodeSession(s);
      return s;
    }
  };

  function getNextHintLevel(session) {
    var order = ["H1", "H2", "H3", "H4"];
    var idx = typeof session.hintLevelIndex === "number" ? session.hintLevelIndex : 0;
    var safe = Math.max(0, Math.min(idx, order.length - 1));
    session.hintLevelIndex = Math.min(safe + 1, order.length - 1);
    return order[safe];
  }

  function evaluatePlanetStarRating(logs, prevCode, remedialPassed) {
    var list = Array.isArray(logs) ? logs : [];
    var seen = {}, fTotal = 0, fOk = 0, highHint = 0;
    list.forEach(function (it) {
      var qid = it.questionId || "Q";
      if (!seen[qid]) { seen[qid] = true; fTotal += 1; if (it.isCorrect) fOk += 1; }
      if (it.hintLevel === "H3" || it.hintLevel === "H4") highHint += 1;
    });
    var dCount = Object.keys(seen).length;
    if (dCount < EXP.minStarQ || fTotal < EXP.minStarQ) {
      return { code: "UNRATED", studentLabel: "尚未評定", stars: 0, teacherDetail: "不同題目數不足（" + dCount + "/" + EXP.minStarQ + "），尚未評定。" };
    }
    var ratio = fOk / fTotal;
    var nextCode = "ONE_STAR";
    if (ratio >= EXP.masteryRatio && highHint === 0 && remedialPassed) nextCode = "THREE_STARS";
    else if (ratio >= EXP.progressRatio || remedialPassed) nextCode = "TWO_STARS";

    var rank = { UNRATED: 0, ONE_STAR: 1, TWO_STARS: 2, THREE_STARS: 3 };
    var pCode = prevCode && rank[prevCode] !== undefined ? prevCode : "UNRATED";
    if (rank[pCode] > rank[nextCode] && ratio >= 0.5) nextCode = pCode;

    if (nextCode === "THREE_STARS") return { code: "THREE_STARS", studentLabel: "★★★ 精熟", stars: 3, teacherDetail: "首次正確率 " + Math.round(ratio * 100) + "%、補救通過、無 H3/H4。" };
    if (nextCode === "TWO_STARS") return { code: "TWO_STARS", studentLabel: "★★☆ 穩定進步", stars: 2, teacherDetail: "首次正確率 " + Math.round(ratio * 100) + "%、高階提示 " + highHint + " 次。" };
    return { code: "ONE_STAR", studentLabel: "★☆☆ 需要加強", stars: 1, teacherDetail: "首次正確率 " + Math.round(ratio * 100) + "%，建議加強觀念與補救。" };
  }

  function evaluateFiveDimensions(logs, remedialPassed) {
    var list = Array.isArray(logs) ? logs : [];
    var dimsOrder = ["概念理解", "基礎運算", "推理能力", "應用能力", "獨立完成程度"];
    var qCount = {}, dimDistinct = { 概念理解: {}, 基礎運算: {}, 推理能力: {}, 應用能力: {} };
    var dimFirst = { 概念理解: [], 基礎運算: [], 推理能力: [], 應用能力: [] };
    var allDistinct = {}, fTotal = 0, fOk = 0, rTotal = 0, rOk = 0, maxH = 0;

    list.forEach(function (item) {
      var qid = item.questionId || "UNKNOWN";
      qCount[qid] = (qCount[qid] || 0) + 1;
      var isFirst = qCount[qid] === 1;
      allDistinct[qid] = true;
      if (isFirst) { fTotal += 1; if (item.isCorrect) fOk += 1; }
      else { rTotal += 1; if (item.isCorrect) rOk += 1; }
      if (item.hintLevel) { var hn = parseInt(String(item.hintLevel).replace("H", ""), 10) || 0; if (hn > maxH) maxH = hn; }
      if (item.dimension && dimDistinct[item.dimension]) {
        dimDistinct[item.dimension][qid] = true;
        if (isFirst) dimFirst[item.dimension].push(Boolean(item.isCorrect));
      }
    });

    var out = {}, mast = 0, qual = 0;
    ["概念理解", "基礎運算", "推理能力", "應用能力"].forEach(function (d) {
      var dc = Object.keys(dimDistinct[d]).length, fa = dimFirst[d];
      if (dc < EXP.minQ || fa.length === 0) {
        out[d] = { state: "尚需更多練習", detail: "不同題目 " + dc + "/" + EXP.minQ + " 題" };
      } else {
        qual += 1;
        var okN = fa.filter(function (x) { return x; }).length;
        var ratio = okN / fa.length;
        var st = ratio >= EXP.masteryRatio ? "精熟" : (ratio >= EXP.progressRatio ? "穩定進步" : "需要加強");
        if (st === "精熟") mast += 1;
        out[d] = { state: st, detail: "首次正確 " + okN + "/" + fa.length + "（不同題 " + dc + " 題）" };
      }
    });

    var allN = Object.keys(allDistinct).length;
    if (allN < EXP.minQ || fTotal === 0) {
      out["獨立完成程度"] = { state: "尚需更多練習", detail: "尚無足夠作答證據｜補救題：" + (remedialPassed ? "已通過" : "未通過或未作答") };
    } else {
      qual += 1;
      var rAll = fTotal > 0 ? fOk / fTotal : 0;
      var indSt = (rAll >= EXP.masteryRatio && maxH <= EXP.maxHintNum) ? "精熟" : ((rAll >= EXP.progressRatio || rOk > 0) ? "穩定進步" : "需要加強");
      if (indSt === "精熟") mast += 1;
      out["獨立完成程度"] = { state: indSt, detail: "首次正確 " + fOk + "/" + fTotal + "｜最高提示 H" + maxH + "｜補救題：" + (remedialPassed ? "已通過" : "未通過或未作答") };
    }

    var overall = "尚需更多練習";
    if (allN < EXP.minOverallQ || qual < 2) overall = "尚需更多練習";
    else if (mast >= 3 && fTotal > 0 && (fOk / fTotal) >= EXP.masteryRatio && maxH <= EXP.maxHintNum) overall = "精熟";
    else if (fOk >= 1 || rOk > 0) overall = "穩定進步";
    else overall = "需要加強";

    return {
      overallStatus: overall, dimensionsOrder: dimsOrder, dimensions: out,
      summaryLine: "實驗參數｜不同題目數：" + allN + "｜首次正確：" + fOk + "/" + fTotal + "｜重複練習：" + rOk + "/" + rTotal + "｜補救題：" + (remedialPassed ? "已通過" : "未通過或未作答"),
      params: EXP
    };
  }

  var engState = { selectedNodeId: "M1-01" };

  function getSid() {
    var el = document.getElementById("stuInp");
    var d = el && el.value ? el.value.trim() : "";
    var s = (localStorage.getItem("edu_stu") || "").trim();
    return d || s || "訪客學員";
  }

  function advanceToStage2(sid, nid) {
    var s = Repo.getNodeSession(sid, nid);
    s.unlockedStage = Math.max(s.unlockedStage, 2);
    s.currentStage = 2;
    s.lastFeedback = "已進入「引導問題」。階段 1 教材已鎖定，不再返回教材，請依提示思考後作答。";
    s.lastFeedbackType = "ok";
    Repo.saveNodeSession(s);
  }

  function handleStageSubmit(sid, nid, ans) {
    var node = NODES[nid];
    var s = Repo.getNodeSession(sid, nid);
    var st = s.currentStage;
    var spec = st === 2 ? node.stage2Guide : (st === 3 ? node.stage3Check : (st === 4 ? node.stage4Practice : (st === 5 ? node.stage5Remedial : null)));
    if (!spec) return;
    var isRem = st === 5;
    var res = spec.validate(ans, nid);
    var prior = s.logs.filter(function (x) { return x.questionId === spec.questionId; }).length;
    var isFirst = prior === 0;

    if (res.verdict === "unclear" || res.verdict === "partial") {
      Repo.appendAnswerLog(sid, nid, {
        knowledgeNode: node.code, questionId: spec.questionId, dimension: spec.dimension,
        studentAnswer: ans, expectedAnswer: spec.expectedAnswer || spec.expectedAnswerDesc || "",
        isCorrect: false, verdict: res.verdict, errorCode: res.errorCode || "E05", errorLabel: ERR[res.errorCode || "E05"],
        hintLevel: null, isFirstTry: isFirst, completedAt: new Date().toISOString(), isRemedial: isRem, remedialPassed: false
      });
      s = Repo.getNodeSession(sid, nid);
      s.lastFeedback = (res.verdict === "partial" ? "【觀念部分正確，請再補充】" : "【需要補充說明】") + (res.supplementPrompt || "請再補充你的想法與理由。");
      s.lastFeedbackType = "guide";
      Repo.saveNodeSession(s);
      return;
    }

    var hLv = !res.ok ? getNextHintLevel(s) : null;
    var rem = !res.ok ? fixGuide(res.errorCode, ans, nid, res.contextKey) : null;

    s = Repo.appendAnswerLog(sid, nid, {
      knowledgeNode: node.code, questionId: spec.questionId, dimension: spec.dimension,
      studentAnswer: ans, expectedAnswer: spec.expectedAnswer || spec.expectedAnswerDesc || "",
      isCorrect: Boolean(res.ok), verdict: res.ok ? "pass" : "incorrect",
      errorCode: res.ok ? null : res.errorCode, errorLabel: res.ok ? null : ERR[res.errorCode],
      hintLevel: hLv, isFirstTry: isFirst, completedAt: new Date().toISOString(), isRemedial: isRem, remedialPassed: isRem ? Boolean(res.ok) : false
    });

    if (res.ok) {
      s.hintLevelIndex = 0;
      if (st === 2) { s.currentStage = 3; s.unlockedStage = Math.max(s.unlockedStage, 3); s.lastFeedback = "觀念引導清楚！現在進入「理解檢查」。"; s.lastFeedbackType = "ok"; }
      else if (st === 3) { s.currentStage = 4; s.unlockedStage = Math.max(s.unlockedStage, 4); s.lastFeedback = "理解檢查通過！接著進入「互動練習」。"; s.lastFeedbackType = "ok"; }
      else if (st === 4) { s.currentStage = 5; s.unlockedStage = Math.max(s.unlockedStage, 5); s.lastFeedback = "互動練習完成！接下來進入「個人化補救」，以不同情境檢驗相同觀念。"; s.lastFeedbackType = "ok"; }
      else if (st === 5) { s.remedialPassed = true; s.currentStage = 6; s.unlockedStage = Math.max(s.unlockedStage, 6); s.lastFeedback = "補救題也完成！現在進入「學習總結」。"; s.lastFeedbackType = "ok"; }
      Repo.saveNodeSession(s);
    } else {
      var ht = node.hints[hLv] || node.hints.H1;
      s.lastFeedback = rem.ok1 + "\n" + rem.ok2 + "\n【" + hLv + " 提示】" + ht;
      s.lastFeedbackType = "guide";
      Repo.saveNodeSession(s);
    }
  }

  function esc(x) {
    return String(x || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderStageBody(node, s, mEval, starEval) {
    var st = s.currentStage;
    if (st === 1) {
      return "<h4 class=\"te-card-title\">階段 1：教材學習</h4><div class=\"te-sub-box\">" + esc(node.stage1Material) + "</div><div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-to-stage2\">完成教材，進入階段 2（引導問題）</button></div>";
    }
    if (st >= 2 && st <= 5) {
      var q = st === 2 ? node.stage2Guide : (st === 3 ? node.stage3Check : (st === 4 ? node.stage4Practice : node.stage5Remedial));
      var t = st === 2 ? "階段 2：引導問題（教材已鎖定，不返回階段 1）" : (st === 3 ? "階段 3：理解檢查" : (st === 4 ? "階段 4：互動練習" : "階段 5：個人化補救（不同情境檢驗相同觀念）"));
      return "<h4 class=\"te-card-title\">" + esc(t) + "</h4>" + (st === 5 && q.contextNote ? "<div class=\"te-sub-box\">" + esc(q.contextNote) + "</div>" : "") + "<p class=\"te-text\">" + esc(q.prompt) + "</p><input type=\"text\" class=\"te-input\" id=\"te-ans-input\" placeholder=\"請輸入你的想法或答案\" /><div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-submit-ans\">送出作答</button></div>";
    }
    var dimsHtml = mEval.dimensionsOrder.map(function (d) {
      var o = mEval.dimensions[d];
      return "<div class=\"te-dim-item\"><div class=\"te-dim-name\">" + esc(d) + "</div><div class=\"te-dim-val\">" + esc(o.state) + "</div><div style=\"font-size:12px;color:#CBD5E1;margin-top:4px;\">" + esc(o.detail) + "</div></div>";
    }).join("");
    var logsHtml = (s.logs && s.logs.length) ? "<div class=\"te-sub-box\"><strong>作答紀錄明細（本機原型儲存）：</strong><ul class=\"te-log-list\">" + s.logs.map(function (lg) {
      var stTxt = lg.isCorrect ? "正確" : ((lg.verdict === "unclear" || lg.verdict === "partial") ? "需補充說明" : "需再釐清");
      return "<li>" + esc(getStudentTitle(lg.knowledgeNode)) + "｜" + (lg.isFirstTry ? "首次作答" : "重複練習") + "｜作答「" + esc(lg.studentAnswer) + "」｜" + stTxt + (lg.hintLevel ? "｜提示 " + esc(lg.hintLevel) : "") + (lg.isRemedial ? "｜補救題" : "") + "</li>";
    }).join("") + "</ul></div>" : "";
    return "<h4 class=\"te-card-title\">階段 6：學習總結</h4><div class=\"te-sub-box\"><strong>星球精熟度：</strong>" + esc(starEval.studentLabel) + "\n<strong>整體狀態：</strong>" + esc(mEval.overallStatus) + "\n" + esc(mEval.summaryLine) + "</div><div class=\"te-dim-grid\">" + dimsHtml + "</div>" + logsHtml + "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn secondary\" id=\"te-restart-node\">重新學習此單元（明確重設）</button></div>";
  }

  function renderTeachingEngine(container, preferredNodeId) {
    if (!container) return;
    if (preferredNodeId && NODES[preferredNodeId]) engState.selectedNodeId = preferredNodeId;
    var sid = getSid();
    var node = NODES[engState.selectedNodeId] || NODES["M1-01"];
    var s = Repo.getNodeSession(sid, node.id);
    var mEval = evaluateFiveDimensions(s.logs, s.remedialPassed);
    var starEval = evaluatePlanetStarRating(s.logs, s.starCode, s.remedialPassed);

    var labels = ["1. 教材學習", "2. 引導問題", "3. 理解檢查", "4. 互動練習", "5. 個人化補救", "6. 學習總結"];
    var strip = labels.map(function (lb, i) {
      var n = i + 1;
      var c = "te-stage-step" + (s.currentStage === n ? " active" : (n < s.currentStage ? " done" : "")) + ((n > s.unlockedStage || (s.currentStage >= 2 && n === 1)) ? " locked" : "");
      return "<div class=\"" + c + "\">" + (s.currentStage >= 2 && n === 1 ? "🔒 " : "") + esc(lb) + "</div>";
    }).join("");

    var tabs = Object.keys(NODES).map(function (k) {
      var it = NODES[k];
      return "<button type=\"button\" class=\"te-topic-btn" + (it.id === node.id ? " active" : "") + "\" data-te-node=\"" + esc(it.id) + "\">" + esc(getStudentTitle(it.id)) + "</button>";
    }).join("");

    var fb = s.lastFeedback ? "<div class=\"te-feedback " + (s.lastFeedbackType === "ok" ? "ok" : "guide") + "\">" + esc(s.lastFeedback) + "</div>" : "";

    container.innerHTML = "<section class=\"te-root\"><div class=\"te-header-bar\"><div><strong>" + esc(getStudentTitle(node.id)) + "</strong> <span style=\"font-size:13px;color:#CBD5E1;\">學員：" + esc(sid) + "｜" + esc(starEval.studentLabel) + "</span></div><span class=\"te-mode-pill\">循序六階段教學</span></div><div class=\"te-topic-tabs\">" + tabs + "</div><div class=\"te-stage-strip\">" + strip + "</div><div class=\"te-card\">" + renderStageBody(node, s, mEval, starEval) + fb + "</div></section>";

    container.querySelectorAll("[data-te-node]").forEach(function (b) {
      b.addEventListener("click", function () { engState.selectedNodeId = b.getAttribute("data-te-node"); renderTeachingEngine(container, engState.selectedNodeId); });
    });
    var b2 = document.getElementById("te-to-stage2");
    if (b2) b2.addEventListener("click", function () { advanceToStage2(getSid(), node.id); renderTeachingEngine(container, node.id); });
    var sub = document.getElementById("te-submit-ans");
    var inp = document.getElementById("te-ans-input");
    if (sub && inp) sub.addEventListener("click", function () {
      var v = inp.value.trim();
      if (!v) { var cs = Repo.getNodeSession(getSid(), node.id); cs.lastFeedback = "【需要補充說明】請先寫出你的想法或答案再送出。"; cs.lastFeedbackType = "guide"; Repo.saveNodeSession(cs); renderTeachingEngine(container, node.id); return; }
      handleStageSubmit(getSid(), node.id, v);
      renderTeachingEngine(container, node.id);
    });
    var rst = document.getElementById("te-restart-node");
    if (rst) rst.addEventListener("click", function () {
      Repo.saveNodeSession({ studentId: getSid(), nodeId: node.id, currentStage: 1, unlockedStage: 1, hintLevelIndex: 0, remedialPassed: false, starCode: "UNRATED", lastFeedback: "已重新開始此單元，歡迎先回顧教材重點。", lastFeedbackType: "ok", logs: [] });
      renderTeachingEngine(container, node.id);
    });
  }

  window.TeachingEngineModule = {
    render: renderTeachingEngine,
    repository: Repo,
    evaluateFiveDimensions: evaluateFiveDimensions,
    evaluatePlanetStarRating: evaluatePlanetStarRating,
    getStudentTitle: getStudentTitle,
    getTeacherLabel: getTeacherLabel,
    semanticHook: SemanticHook,
    experimentalParams: EXP,
    nodes: NODES
  };
})();

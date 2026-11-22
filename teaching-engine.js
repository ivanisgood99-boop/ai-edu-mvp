/* 第二階段：學生端教學引擎（課本式數學排版、九段式教材標準、六階段流程、直線與圓、星球星級精熟度） */
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

  function esc(x) {
    return String(x || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* 課本式數學排版轉換器：將純文字/程式語法轉為課本式 HTML（不改動內部判題資料） */
  function formatMathForStudent(rawText) {
    var s = esc(String(rawText || ""));

    // 1. 處理 sqrt(...) -> 根號框線（支援巢狀括號）
    var guard = 0;
    while (s.indexOf("sqrt(") !== -1 && guard < 20) {
      guard += 1;
      var idx = s.indexOf("sqrt(");
      var startInner = idx + 5;
      var depth = 1;
      var pos = startInner;
      while (pos < s.length && depth > 0) {
        if (s[pos] === "(") depth += 1;
        else if (s[pos] === ")") depth -= 1;
        pos += 1;
      }
      if (depth === 0) {
        var inner = s.slice(startInner, pos - 1);
        var replacement =
          "<span class=\"math-sqrt math-expr\"><span class=\"math-sqrt-sign\">√</span><span class=\"math-radicand\">" +
          inner +
          "</span></span>";
        s = s.slice(0, idx) + replacement + s.slice(pos);
      } else {
        break;
      }
    }

    // 2. 處理簡單分數 token：分子/分母（僅限不含空白的代數/數字分數）
    s = s.replace(/([A-Za-z0-9_()+\-×·]+)\/([A-Za-z0-9_()+\-×·]+)/g, function (match, num, den) {
      return (
        "<span class=\"math-frac math-expr\">" +
        "<span class=\"math-num\">" + num + "</span>" +
        "<span class=\"math-den\">" + den + "</span>" +
        "</span>"
      );
    });

    // 3. 處理下標 _x 或 _{xy}
    s = s.replace(/_\{([^}]+)\}/g, "<sub class=\"math-expr\">$1</sub>");
    s = s.replace(/_([A-Za-z0-9])/g, "<sub class=\"math-expr\">$1</sub>");

    // 4. 處理上標 ^n 或 ^{mn}
    s = s.replace(/\^\{([^}]+)\}/g, "<sup class=\"math-expr\">$1</sup>");
    s = s.replace(/\^([+\-]?[A-Za-z0-9]+)/g, "<sup class=\"math-expr\">$1</sup>");

    // 5. 換行轉 <br>
    s = s.replace(/\n/g, "<br>");
    return "<span class=\"math-expr\">" + s + "</span>";
  }

  /* 九段式課本教材結構建構器（可重複用於所有課程知識點） */
  function buildStructuredLesson(cfg) {
    return {
      sections: [
        { key: "motivation", label: "1. 學習動機與概念引入", content: cfg.motivation },
        { key: "intuition", label: "2. 直觀理解與圖形輔助", content: cfg.intuition, diagramSvg: cfg.diagramSvg || "", diagramCaption: cfg.diagramCaption || "" },
        { key: "definition", label: "3. 正式數學定義", content: cfg.definition },
        { key: "derivation", label: "4. 公式推導及推導理由", content: cfg.derivation },
        { key: "conditions", label: "5. 公式成立條件及適用範圍", content: cfg.conditions },
        { key: "example", label: "6. 完整例題與逐步解釋", content: cfg.example },
        { key: "pitfalls", label: "7. 常見錯誤及錯誤原因", content: cfg.pitfalls },
        { key: "practice", label: "8. 獨立練習", content: cfg.practice },
        { key: "extension", label: "9. 延伸理解及知識連結", content: cfg.extension }
      ],
      plainSummary: cfg.plainSummary || (cfg.definition + "\n" + cfg.example)
    };
  }

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
      var hasReason = raw.length >= 8 && (raw.indexOf("因為") !== -1 || raw.indexOf("所以") !== -1 || raw.indexOf("平方") !== -1 || raw.indexOf("斜率") !== -1 || raw.indexOf("半徑") !== -1 || raw.indexOf("距離") !== -1 || raw.indexOf("圓心") !== -1 || raw.indexOf("交點") !== -1 || raw.indexOf("正") !== -1 || raw.indexOf("負") !== -1 || raw.indexOf("0") !== -1 || raw.indexOf("相等") !== -1 || raw.indexOf("分母") !== -1);
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
      lesson: buildStructuredLesson({
        motivation: "在平面地圖或導航系統中，我們常需要知道兩個位置之間的直線距離，而不只是沿著街道繞行的路程。把位置寫成坐標後，就能用代數計算精準求出距離。",
        intuition: "把兩點 A(x_1, y_1) 與 B(x_2, y_2) 看成直角三角形的兩個頂點：先沿水平方向走 |x_2 - x_1|，再沿鉛直方向走 |y_2 - y_1|，斜邊就是兩點直線距離。",
        diagramSvg: "<svg viewBox=\"0 0 260 120\" width=\"260\" height=\"120\" aria-label=\"兩點距離直角三角形示意圖\"><line x1=\"40\" y1=\"95\" x2=\"190\" y2=\"95\" stroke=\"#38BDF8\" stroke-width=\"2.5\"/><line x1=\"190\" y1=\"95\" x2=\"190\" y2=\"30\" stroke=\"#2DD4BF\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"95\" x2=\"190\" y2=\"30\" stroke=\"#F8FAFC\" stroke-width=\"2.5\"/><rect x=\"178\" y=\"83\" width=\"12\" height=\"12\" fill=\"none\" stroke=\"#94A3B8\" stroke-width=\"1.2\"/><circle cx=\"40\" cy=\"95\" r=\"4\" fill=\"#38BDF8\"/><circle cx=\"190\" cy=\"30\" r=\"4\" fill=\"#F8FAFC\"/><text x=\"24\" y=\"112\" fill=\"#CBD5E1\" font-size=\"11\">A(x₁,y₁)</text><text x=\"176\" y=\"22\" fill=\"#F8FAFC\" font-size=\"11\">B(x₂,y₂)</text><text x=\"92\" y=\"112\" fill=\"#38BDF8\" font-size=\"11\">|x₂ - x₁|</text><text x=\"196\" y=\"66\" fill=\"#2DD4BF\" font-size=\"11\">|y₂ - y₁|</text></svg>",
        diagramCaption: "圖示：水平差與鉛直差構成直角三角形兩股，連線段長為斜邊。",
        definition: "在坐標平面上，設點 A(x_1, y_1)、B(x_2, y_2)（其中 x_1, y_1, x_2, y_2 為實數），兩點間的距離記為 AB。",
        derivation: "第一步：水平方向坐標差為 |x_2 - x_1|，鉛直方向坐標差為 |y_2 - y_1|。\n第二步：水平線與鉛直線互相垂直，形成直角三角形。\n第三步：依畢氏定理「斜邊² = 兩股平方和」，得 AB² = (x_2 - x_1)² + (y_2 - y_1)²，開算術平方根即得 AB = sqrt((x_2 - x_1)² + (y_2 - y_1)²)。",
        conditions: "適用於平面直角坐標系中任意兩點 A、B；平方後皆為非負實數，因此根號內必大於或等於 0。",
        example: "已知點 P(1, 2) 與點 Q(4, 6)，求 PQ 長。\n理由與步驟：x 差為 4 - 1 = 3（因為往右移動 3 單位），y 差為 6 - 2 = 4（因為往上移動 4 單位）。代入距離公式得 PQ = sqrt(3² + 4²) = sqrt(9 + 16) = sqrt(25) = 5。",
        pitfalls: "1. 忘記將 x 差與 y 差先平方再相加，誤算成 (x_2 - x_1) + (y_2 - y_1)。\n2. 算完平方和後忘記開根號。",
        practice: "試算點 A(-2, 1) 與點 B(2, 4) 的距離：x 差為 4，y 差為 3，距離為 sqrt(4² + 3²) = 5。",
        extension: "兩點距離公式是後續推導「圓的標準式 (x - h)² + (y - k)² = r²」的核心起點。"
      }),
      stage2Guide: { questionId: "LC-01-S2", dimension: "推理能力", prompt: "請說明：為什麼兩點距離公式中把 x 坐標差與 y 坐標差都先平方，結果不會出現負數？", expectedAnswerDesc: "說明實數平方非負", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-01-S3", dimension: "概念理解", prompt: "【理解檢查】若兩點水平距離為 6、鉛直距離為 8，兩點連線段長為多少？（輸入整數）", expectedAnswer: "10", validate: makeIntValidator("10", ["14", "2"], "E01") },
      stage4Practice: { questionId: "LC-01-S4", dimension: "基礎運算", prompt: "【互動練習】計算點 (-2, 1) 與點 (2, 4) 之間的距離。（輸入整數）", expectedAnswer: "5", validate: makeIntValidator("5", ["7", "1"], "E04") },
      stage5Remedial: { questionId: "LC-01-S5", dimension: "應用能力", contextNote: "情境轉換：直角航線位移距離計算", prompt: "【個人化補救題】巡檢機器人從原點 (0, 0) 向東移動 12 單位，再向北移動 5 單位，起終點直線距離為多少單位？（輸入整數）", expectedAnswer: "13", validate: makeIntValidator("13", ["17", "7"], "E04") },
      hints: { H1: "先找水平變化量與鉛直變化量。", H2: "套用畢氏定理：距離² = 水平差² + 鉛直差²。", H3: "12² + 5² = 144 + 25 = 169。", H4: "完整解析：sqrt(169) = 13。" }
    },
    "LC-02": {
      id: "LC-02", code: "LC-02", title: "直線的斜率與傾斜程度", isAssessment: false,
      lesson: buildStructuredLesson({
        motivation: "登山或騎單車時，我們常說某段坡道「很陡」或「很平緩」。在坐標平面上，如何用一個數字精確描述直線的傾斜程度？這就是斜率要解決的問題。",
        intuition: "斜率衡量的是「每當水平位置增加 1 單位時，鉛直高度改變多少」。往右上傾斜時高度增加（正值），往右下傾斜時高度下降（負值）。",
        diagramSvg: "<svg viewBox=\"0 0 260 120\" width=\"260\" height=\"120\" aria-label=\"直線斜率與鉛直線示意圖\"><line x1=\"25\" y1=\"100\" x2=\"125\" y2=\"35\" stroke=\"#38BDF8\" stroke-width=\"2.5\"/><line x1=\"195\" y1=\"20\" x2=\"195\" y2=\"100\" stroke=\"#F87171\" stroke-width=\"2.5\" stroke-dasharray=\"4 3\"/><text x=\"35\" y=\"25\" fill=\"#38BDF8\" font-size=\"11\">上升：m &gt; 0</text><text x=\"162\" y=\"114\" fill=\"#FCA5A5\" font-size=\"11\">鉛直線：無斜率</text></svg>",
        diagramCaption: "圖示：斜直線具有明確傾斜比值；鉛直線因水平變化量為 0 而無斜率。",
        definition: "在坐標平面上，若直線通過相異兩點 A(x_1, y_1) 與 B(x_2, y_2)，且 x_1 ≠ x_2，則此直線的斜率 m 定義為鉛直變化量與水平變化量的比值。",
        derivation: "第一步：說明斜率代表鉛直變化量 (y_2 - y_1) 與水平變化量 (x_2 - x_1) 的比值。\n第二步：寫出斜率公式 m = (y_2 - y_1)/(x_2 - x_1)。\n第三步（鉛直線推導）：取鉛直線上的兩點 A(2, 1)、B(2, 5)。\n第四步：代入公式得 (5 - 1)/(2 - 2) = 4/0。\n第五步：數學上「除以零」沒有定義，因此 4/0 不代表任何實數。\n第六步：推廣到一般鉛直線，其上任意兩點 x 坐標皆相等（x_1 = x_2），分母 x_2 - x_1 必定為 0，故鉛直線的斜率不存在。",
        conditions: "斜率公式 m = (y_2 - y_1)/(x_2 - x_1) 成立的前提是 x_1 ≠ x_2（分母不為 0）。水平線（y_1 = y_2, x_1 ≠ x_2）斜率為 0；鉛直線（x_1 = x_2）斜率不存在。",
        example: "求通過點 (2, 5) 與點 (6, -3) 的直線斜率。\n理由與步驟：分子為 y 變化量 (-3) - 5 = -8，分母為 x 變化量 6 - 2 = 4（分子與分母須對應同一點順序）。故 m = (-8)/4 = -2，表示 x 每增加 1 單位，y 減少 2 單位。",
        pitfalls: "1. 分子放 x 差、分母放 y 差，把比值顛倒。\n2. 分子算 y_2 - y_1，分母卻算 x_1 - x_2，導致正負號寫反。",
        practice: "若兩點為 (0, 1) 與 (4, 9)，斜率為 (9 - 1)/(4 - 0) = 8/4 = 2。",
        extension: "知道斜率與一點後，即可進一步建立直線方程式；平行直線斜率相等（當斜率皆存在時）。"
      }),
      stage2Guide: { questionId: "LC-02-S2", dimension: "推理能力", prompt: "請說明：當直線由左向右往上攀升時，為什麼斜率會是正數？", expectedAnswerDesc: "x 增大且 y 增大，同號相除為正", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-02-S3", dimension: "概念理解", prompt: "【理解檢查】水平線上任兩點 y 坐標相同，它的斜率是多少？（輸入整數）", expectedAnswer: "0", validate: makeIntValidator("0", ["1"], "E01") },
      stage4Practice: { questionId: "LC-02-S4", dimension: "基礎運算", prompt: "【互動練習】求通過點 (2, 5) 與點 (6, -3) 的直線斜率。（輸入整數）", expectedAnswer: "-2", validate: makeIntValidator("-2", ["2", "-8"], "E04") },
      stage5Remedial: { questionId: "LC-02-S5", dimension: "應用能力", contextNote: "情境轉換：坡道高度與水平距離比值", prompt: "【個人化補救題】步道起點水平 0、高度 1，走到水平 4 時高度為 9，此段平均斜率為多少？（輸入整數）", expectedAnswer: "2", validate: makeIntValidator("2", ["8", "4"], "E04") },
      hints: { H1: "斜率是 y 變化量除以 x 變化量。", H2: "注意分子與分母減法順序要一致。", H3: "(-3 - 5)/(6 - 2) = -8/4。", H4: "完整解析：斜率為 -2。" }
    },
    "LC-03": {
      id: "LC-03", code: "LC-03", title: "直線方程式的建立與判讀", isAssessment: false,
      lesson: buildStructuredLesson({
        motivation: "當我們知道一條路線的起點與傾斜程度時，希望寫出一個代數式，能快速判斷任意地點是否在這條路線上，這就是直線方程式的作用。",
        intuition: "直線上任一點 P(x, y) 與定點 P_0(x_0, y_0) 連成的線段，其傾斜程度都必須等於直線的斜率 m。",
        definition: "平面上滿足同一線性關係的點 (x, y) 所成的集合，可用二元一次方程式表示，稱為該直線的方程式。",
        derivation: "第一步：設直線上有一固定點 P_0(x_0, y_0)，斜率為 m。\n第二步：任取直線上另一點 P(x, y)（x ≠ x_0），兩點斜率為 (y - y_0)/(x - x_0)。\n第三步：令其等於 m，兩邊同乘 (x - x_0)，得到點斜式 y - y_0 = m(x - x_0)。",
        conditions: "點斜式 y - y_0 = m(x - x_0) 適用於斜率 m 存在的直線；鉛直線 x = x_0 無法用有限斜率 m 表示，需單獨寫成 x = x_0。",
        example: "已知直線斜率為 2 且通過 (0, 1)，方程式為 y - 1 = 2(x - 0)，整理得 y = 2x + 1。\n理由與步驟：代入斜率與定點後展開化簡；檢驗點 (3, 7) 是否在直線上，將 x = 3 代入得 2(3) + 1 = 7，與 y 坐標相等，故在直線上。",
        pitfalls: "1. 代入定點坐標 (x_0, y_0) 時忘記減號變號。\n2. 判斷點是否在直線上時，只看 x 坐標而未同時核對等式左右是否相等。",
        practice: "在 y = 2x + 3 中，當 x = 4 時，y = 2 × 4 + 3 = 11。",
        extension: "直線方程式能與圓的方程式聯立，用來尋找直線與圓的交點或判斷相切條件。"
      }),
      stage2Guide: { questionId: "LC-03-S2", dimension: "推理能力", prompt: "請說明：如何判斷一個已知點 (a, b) 是否落在某條直線方程式上？", expectedAnswerDesc: "將 x=a, y=b 代入方程式檢驗等式是否成立", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-03-S3", dimension: "概念理解", prompt: "【理解檢查】直線 y = 3x - 2 中，當 x = 0 時 y 的值是多少？（輸入整數）", expectedAnswer: "-2", validate: makeIntValidator("-2", ["2", "3"], "E01") },
      stage4Practice: { questionId: "LC-03-S4", dimension: "基礎運算", prompt: "【互動練習】若直線方程式為 y = 2x + 3，當 x = 4 時 y 的值是多少？（輸入整數）", expectedAnswer: "11", validate: makeIntValidator("11", ["9", "14"], "E04") },
      stage5Remedial: { questionId: "LC-03-S5", dimension: "應用能力", contextNote: "情境轉換：租用設備線性費用計算", prompt: "【個人化補救題】某設備租用費率為「基本費 20 元加上每小時 15 元」，使用 2 小時的總費用是多少元？（輸入整數）", expectedAnswer: "50", validate: makeIntValidator("50", ["35", "30"], "E06") },
      hints: { H1: "把題目給的數值代入對應變數。", H2: "先算乘法項，再做加法。", H3: "20 + 15 × 2 = 20 + 30。", H4: "完整解析：總費用為 50 元。" }
    },
    "LC-04": {
      id: "LC-04", code: "LC-04", title: "圓的方程式與圓心半徑", isAssessment: false,
      lesson: buildStructuredLesson({
        motivation: "無線基地台訊號覆蓋範圍、圓形跑道與齒輪輪廓，在幾何上都與「到定點等距離的點的集合」有關。用方程式描述圓，能將幾何位置轉為代數條件。",
        intuition: "圓上任何一點 P(x, y) 到圓心 C(h, k) 的距離都固定等於半徑 r。",
        diagramSvg: "<svg viewBox=\"0 0 260 120\" width=\"260\" height=\"120\" aria-label=\"圓心與半徑示意圖\"><circle cx=\"115\" cy=\"62\" r=\"40\" fill=\"none\" stroke=\"#38BDF8\" stroke-width=\"2.2\"/><line x1=\"115\" y1=\"62\" x2=\"155\" y2=\"62\" stroke=\"#2DD4BF\" stroke-width=\"2.2\"/><circle cx=\"115\" cy=\"62\" r=\"3.5\" fill=\"#F8FAFC\"/><text x=\"82\" y=\"56\" fill=\"#F8FAFC\" font-size=\"11\">C(h,k)</text><text x=\"125\" y=\"54\" fill=\"#2DD4BF\" font-size=\"11\">r</text></svg>",
        diagramCaption: "圖示：圓上任一點到圓心 C(h, k) 的距離恆等於半徑 r。",
        definition: "平面上到定點 C(h, k) 的距離等於定長 r（r > 0）的所有點 P(x, y) 所成的圖形稱為圓，C 稱為圓心，r 稱為半徑。",
        derivation: "第一步：由兩點距離公式，點 P(x, y) 到圓心 C(h, k) 的距離為 CP = sqrt((x - h)² + (y - k)²)。\n第二步：依定義令 CP = r。\n第三步：兩邊同時平方（因兩邊皆非負），得圓的標準式 (x - h)² + (y - k)² = r²。",
        conditions: "半徑 r 必須大於 0（r > 0）；標準式中 x - h 與 y - k 的減號代表平移方向，因此圓心是 (+h, +k)。",
        example: "圓方程式 (x - 2)² + (y - 5)² = 16 的圓心為 (2, 5)，半徑 r = sqrt(16) = 4。\n理由與步驟：對照標準式 (x - h)² + (y - k)² = r²，右邊 16 是 r²，故 r = 4（半徑取正數）。",
        pitfalls: "1. 把右邊的 r² 直接當成半徑 r（例如把 16 當成半徑 16）。\n2. 看到 (x + 3)² 誤以為圓心 x 坐標是 +3，忽略 x - (-3) = x + 3。",
        practice: "圓心在 (0, 0)、半徑為 5 的圓，其標準式右邊 r² = 5² = 25。",
        extension: "展開標準式 (x - h)² + (y - k)² = r² 可得圓的一般式 x² + y² + dx + ey + f = 0。"
      }),
      stage2Guide: { questionId: "LC-04-S2", dimension: "推理能力", prompt: "請說明：為什麼圓的標準式右邊是 r² 而不是 r，且為什麼 r 必須大於 0？", expectedAnswerDesc: "由距離公式平方而來，半徑長度需為正數", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-04-S3", dimension: "概念理解", prompt: "【理解檢查】圓方程式 (x - 2)² + (y - 5)² = 16 的半徑 r 是多少？（輸入整數）", expectedAnswer: "4", validate: makeIntValidator("4", ["16", "8"], "E02") },
      stage4Practice: { questionId: "LC-04-S4", dimension: "基礎運算", prompt: "【互動練習】若圓心為 (0, 0)、半徑為 5，則 r² 的值是多少？（輸入整數）", expectedAnswer: "25", validate: makeIntValidator("25", ["10", "5"], "E04") },
      stage5Remedial: { questionId: "LC-04-S5", dimension: "應用能力", contextNote: "情境轉換：基地台訊號圓形範圍半徑平方", prompt: "【個人化補救題】某訊號基地台半徑為 7 公里，在圓方程式標準式中右邊常數 r² 為多少？（輸入整數）", expectedAnswer: "49", validate: makeIntValidator("49", ["14", "7"], "E04") },
      hints: { H1: "標準式右邊是半徑的平方。", H2: "7 的平方是 7 × 7。", H3: "7 × 7 = 49。", H4: "完整解析：r² = 49。" }
    },
    "LC-05": {
      id: "LC-05", code: "LC-05", title: "直線與圓的位置關係", isAssessment: false,
      lesson: buildStructuredLesson({
        motivation: "當一條航線或光束經過圓形區域時，我們想知道它會穿過區域（兩個交點）、擦邊而過（一個切點），還是完全避開（沒有交點）。",
        intuition: "只要比較「圓心到直線的垂直距離 d」與「圓的半徑 r」，就能立刻知道兩者遠近關係。",
        definition: "設圓的半徑為 r（r > 0），圓心到直線 L 的距離為 d：\n1. d < r：直線與圓交於相異兩點（相割）。\n2. d = r：直線與圓恰交於一點（相切），該直線稱為切線。\n3. d > r：直線與圓沒有交點（不相交）。",
        derivation: "第一步：圓上任一點到圓心的距離都等於 r。\n第二步：圓心到直線的距離 d 是所有點到直線距離中的最短距離。\n第三步：若 d < r，代表直線深入圓內，可找到兩個距離圓心為 r 的點；若 d = r，恰在邊界接觸一點；若 d > r，整條直線都在圓外，無交點。",
        conditions: "半徑 r > 0 且距離 d ≥ 0；比較 d 與 r 時，兩者必須使用相同的長度單位。",
        example: "若圓半徑 r = 6，圓心到直線距離 d = 6，則 d = r，兩者位置關係為相切，交點數為 1。\n理由與步驟：因為垂足到圓心距離恰等於半徑，所以只有該切點同時落在圓與直線上。",
        pitfalls: "1. 把 d = r（相切，1 個交點）誤記成 2 個交點。\n2. 計算 d - r 或 r - d 時未看清大小順序。",
        practice: "當 r = 10、d = 6 時，d < r（相交兩點），且 r - d = 4。",
        extension: "在代數上，將直線方程式代入圓方程式所得一元二次方程式，其判別式亦可對應交點個數。"
      }),
      stage2Guide: { questionId: "LC-05-S2", dimension: "推理能力", prompt: "請說明：當圓心到直線的距離 d 大於半徑 r 時，為什麼直線與圓沒有交點？", expectedAnswerDesc: "圓上各點到圓心距離等於 r，小於 d 故無交點", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-05-S3", dimension: "概念理解", prompt: "【理解檢查】若圓半徑 r = 6，圓心到直線距離 d = 6，直線與圓有幾個交點？（輸入整數）", expectedAnswer: "1", validate: makeIntValidator("1", ["2", "0"], "E01") },
      stage4Practice: { questionId: "LC-05-S4", dimension: "基礎運算", prompt: "【互動練習】若 r = 10、d = 6，求 r - d 的值是多少？（輸入整數）", expectedAnswer: "4", validate: makeIntValidator("4", ["16", "-4"], "E04") },
      stage5Remedial: { questionId: "LC-05-S5", dimension: "應用能力", contextNote: "情境轉換：航道安全距離與警戒半徑差值", prompt: "【個人化補救題】警戒區半徑為 9 公里，船隻航線距中心 4 公里，兩者距離差（9 - 4）為多少公里？（輸入整數）", expectedAnswer: "5", validate: makeIntValidator("5", ["13", "-5"], "E04") },
      hints: { H1: "比較圓心到直線距離 d 與半徑 r。", H2: "相切時 d = r，交點數為 1。", H3: "計算 9 - 4。", H4: "完整解析：9 - 4 = 5。" }
    },
    "LC-06": {
      id: "LC-06", code: "LC-06", title: "直線與圓的綜合應用", isAssessment: false,
      lesson: buildStructuredLesson({
        motivation: "實際的幾何或應用題目往往不會直接告訴你公式名稱，而是混合了坐標距離、斜率、直線與圓的條件，需要我們先整理資訊再解題。",
        intuition: "解綜合題時，先將文字條件翻譯成坐標、距離或方程式，再依題目所求選擇對應工具。",
        definition: "綜合運用平面坐標距離、直線斜率與方程式、圓的標準式及點與圓／直線與圓位置關係來解決問題。",
        derivation: "第一步：判讀題目給定的幾何元素（圓心、半徑、點坐標、直線方向）。\n第二步：計算關鍵量（如點到圓心距離或斜率）。\n第三步：依幾何性質完成推論或數值計算。",
        conditions: "使用各性質前需確認對應條件成立（如半徑 r > 0、斜率存在等）。",
        example: "以原點 (0, 0) 為圓心、半徑 5 的圓，點 (3, 4) 到圓心距離為 sqrt(3² + 4²) = 5。\n理由與步驟：距離等於半徑 5，因此點 (3, 4) 恰落在圓上。",
        pitfalls: "1. 題目問距離卻直接把坐標相加。\n2. 忽略正負號或單位不一致。",
        practice: "若點到圓心距離平方為 13、半徑平方為 25，25 - 13 = 12。",
        extension: "完成本知識點後，可進入「直線與圓星球綜合評量」檢驗全單元整合能力。"
      }),
      stage2Guide: { questionId: "LC-06-S2", dimension: "推理能力", prompt: "請說明：要判斷一個點是在圓內、圓上還是圓外，應該比較哪兩個量？", expectedAnswerDesc: "比較點到圓心的距離與半徑的大小", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-06-S3", dimension: "概念理解", prompt: "【理解檢查】以原點 (0, 0) 為圓心、半徑 5 的圓，點 (3, 4) 到圓心距離為多少？（輸入整數）", expectedAnswer: "5", validate: makeIntValidator("5", ["7", "25"], "E01") },
      stage4Practice: { questionId: "LC-06-S4", dimension: "基礎運算", prompt: "【互動練習】若點到圓心距離平方為 13，半徑平方為 25，兩者差值（25 - 13）為多少？（輸入整數）", expectedAnswer: "12", validate: makeIntValidator("12", ["38", "-12"], "E04") },
      stage5Remedial: { questionId: "LC-06-S5", dimension: "應用能力", contextNote: "情境轉換：景觀摩天輪／旋轉盤幾何定位", prompt: "【個人化補救題】旋轉觀景台半徑 8 公尺，中心在 (0, 0)，若座艙位於 (0, 8)，它與中心的距離是多少公尺？（輸入整數）", expectedAnswer: "8", validate: makeIntValidator("8", ["16", "0"], "E06") },
      hints: { H1: "先看點與中心的坐標差。", H2: "從 (0, 0) 到 (0, 8) 只有鉛直移動。", H3: "|8 - 0| = 8。", H4: "完整解析：距離為 8 公尺。" }
    },
    "LC-ASSESS": {
      id: "LC-ASSESS", code: "LC-ASSESS", title: "直線與圓星球綜合評量", isAssessment: true,
      lesson: buildStructuredLesson({
        motivation: "這是「直線與圓」單元的最後一站（第 2n+1 關卡），用來整合坐標距離、斜率、直線與圓方程式及位置關係。",
        intuition: "把各知識點視為工具箱裡的零件，遇到綜合題時先釐清題意，再挑選合適工具。",
        definition: "本關卡綜合檢驗直線與圓核心概念之理解、推理與運算應用。",
        derivation: "第一步：確認題目涉及的幾何對象與已知條件。\n第二步：選用距離、斜率或圓與直線位置關係判準。\n第三步：逐步驗算並確認單位與正負號。",
        conditions: "所有代數運算與幾何判準皆須符合定義與適用前提。",
        example: "若圓心到直線距離 d 等於半徑 r，兩者位置關係為相切（恰有 1 個交點）。",
        pitfalls: "1. 綜合題中混用不同題目的數據。\n2. 忽略題目指定算式或單位。",
        practice: "5 + 4 + 3 = 12。",
        extension: "完成本關卡後，可在學習總結檢視五維度與星球星級精熟度。"
      }),
      stage2Guide: { questionId: "LC-ASSESS-S2", dimension: "推理能力", prompt: "請綜合說明：在坐標平面上，直線與圓的位置關係如何透過距離與半徑來判斷？", expectedAnswerDesc: "說明圓心到直線距離 d 與半徑 r 的大小關係", validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); } },
      stage3Check: { questionId: "LC-ASSESS-S3", dimension: "概念理解", prompt: "【綜合理解】若圓心到直線距離 d 等於半徑 r，兩者位置關係是哪一種？（請輸入 A、B 或 C）\nA. 相切\nB. 交於兩點\nC. 不相交", expectedAnswer: "A", validate: function (v) { var u = String(v || "").trim().toUpperCase(); if (!u) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入 A、B 或 C。" }); if (u === "A") return resObj("pass", true, null); if (u === "B" || u === "C") return resObj("incorrect", false, "E01"); return resObj("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C。" }); } },
      stage4Practice: { questionId: "LC-ASSESS-S4", dimension: "基礎運算", prompt: "【綜合運算】已知兩點 (1, 2) 與 (4, 6) 距離為 5，斜率 (6 - 2)/(4 - 1) 分子為 4、分母為 3，兩者相加（5 + 4 + 3）為多少？（輸入整數）", expectedAnswer: "12", validate: makeIntValidator("12", ["9", "8"], "E04") },
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

  function renderStage1Content(node) {
    if (node.lesson && Array.isArray(node.lesson.sections)) {
      var blocksHtml = node.lesson.sections.map(function (sec) {
        var diagHtml = "";
        if (sec.diagramSvg) {
          diagHtml =
            "<div class=\"lesson-diagram-wrap\">" +
            sec.diagramSvg +
            (sec.diagramCaption ? "<div class=\"lesson-diagram-caption\">" + formatMathForStudent(sec.diagramCaption) + "</div>" : "") +
            "</div>";
        }
        return (
          "<div class=\"lesson-block\">" +
          "<div class=\"lesson-block-hd\">" + esc(sec.label) + "</div>" +
          "<div class=\"lesson-block-bd\">" + formatMathForStudent(sec.content) + "</div>" +
          diagHtml +
          "</div>"
        );
      }).join("");
      return "<div class=\"lesson-sections\">" + blocksHtml + "</div>";
    }
    return "<div class=\"te-sub-box\">" + formatMathForStudent(node.stage1Material) + "</div>";
  }

  function renderStageBody(node, s, mEval, starEval) {
    var st = s.currentStage;
    if (st === 1) {
      return (
        "<h4 class=\"te-card-title\">階段 1：教材學習（課本式完整講義）</h4>" +
        renderStage1Content(node) +
        "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-to-stage2\">完成教材，進入階段 2（引導問題）</button></div>"
      );
    }
    if (st >= 2 && st <= 5) {
      var q = st === 2 ? node.stage2Guide : (st === 3 ? node.stage3Check : (st === 4 ? node.stage4Practice : node.stage5Remedial));
      var t = st === 2 ? "階段 2：引導問題（教材已鎖定，不返回階段 1）" : (st === 3 ? "階段 3：理解檢查" : (st === 4 ? "階段 4：互動練習" : "階段 5：個人化補救（不同情境檢驗相同觀念）"));
      return (
        "<h4 class=\"te-card-title\">" + esc(t) + "</h4>" +
        (st === 5 && q.contextNote ? "<div class=\"te-sub-box\">" + formatMathForStudent(q.contextNote) + "</div>" : "") +
        "<p class=\"te-text\">" + formatMathForStudent(q.prompt) + "</p>" +
        "<input type=\"text\" class=\"te-input\" id=\"te-ans-input\" placeholder=\"請輸入你的想法或答案\" />" +
        "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-submit-ans\">送出作答</button></div>"
      );
    }
    var dimsHtml = mEval.dimensionsOrder.map(function (d) {
      var o = mEval.dimensions[d];
      return "<div class=\"te-dim-item\"><div class=\"te-dim-name\">" + esc(d) + "</div><div class=\"te-dim-val\">" + esc(o.state) + "</div><div style=\"font-size:12px;color:#CBD5E1;margin-top:4px;\">" + formatMathForStudent(o.detail) + "</div></div>";
    }).join("");
    var logsHtml = (s.logs && s.logs.length) ? "<div class=\"te-sub-box\"><strong>作答紀錄明細（本機原型儲存）：</strong><ul class=\"te-log-list\">" + s.logs.map(function (lg) {
      var stTxt = lg.isCorrect ? "正確" : ((lg.verdict === "unclear" || lg.verdict === "partial") ? "需補充說明" : "需再釐清");
      return "<li>" + esc(getStudentTitle(lg.knowledgeNode)) + "｜" + (lg.isFirstTry ? "首次作答" : "重複練習") + "｜作答「" + formatMathForStudent(lg.studentAnswer) + "」｜" + stTxt + (lg.hintLevel ? "｜提示 " + esc(lg.hintLevel) : "") + (lg.isRemedial ? "｜補救題" : "") + "</li>";
    }).join("") + "</ul></div>" : "";
    return (
      "<h4 class=\"te-card-title\">階段 6：學習總結</h4>" +
      "<div class=\"te-sub-box\"><strong>星球精熟度：</strong>" + esc(starEval.studentLabel) + "<br><strong>整體狀態：</strong>" + esc(mEval.overallStatus) + "<br>" + formatMathForStudent(mEval.summaryLine) + "</div>" +
      "<div class=\"te-dim-grid\">" + dimsHtml + "</div>" +
      logsHtml +
      "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn secondary\" id=\"te-restart-node\">重新學習此單元（明確重設）</button></div>"
    );
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

    var fb = s.lastFeedback ? "<div class=\"te-feedback " + (s.lastFeedbackType === "ok" ? "ok" : "guide") + "\">" + formatMathForStudent(s.lastFeedback) + "</div>" : "";

    container.innerHTML =
      "<section class=\"te-root\">" +
      "<div class=\"te-header-bar\"><div><strong>" + esc(getStudentTitle(node.id)) + "</strong> <span style=\"font-size:13px;color:#CBD5E1;\">學員：" + esc(sid) + "｜" + esc(starEval.studentLabel) + "</span></div><span class=\"te-mode-pill\">循序六階段教學</span></div>" +
      "<div class=\"te-topic-tabs\">" + tabs + "</div>" +
      "<div class=\"te-stage-strip\">" + strip + "</div>" +
      "<div class=\"te-card\">" + renderStageBody(node, s, mEval, starEval) + fb + "</div>" +
      "</section>";

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
    formatMathForStudent: formatMathForStudent,
    buildStructuredLesson: buildStructuredLesson,
    getStudentTitle: getStudentTitle,
    getTeacherLabel: getTeacherLabel,
    semanticHook: SemanticHook,
    experimentalParams: EXP,
    nodes: NODES
  };
})();

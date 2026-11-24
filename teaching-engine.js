/* 學生端教學引擎：Chapter -> Level -> Stage 架構、課本式排版、題庫與精熟度同步 */
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

  var STORE_KEY = "ai_edu_phase2_records_v4";
  var MASTERY_SYNC_KEY = "ai_edu_level_mastery_v1";
  var learningSyncQueues = {};

  function queueLearningAnswer(levelId, log) {
    var key = String(levelId || "");
    if (!key) return Promise.resolve({ ok: false, message: "缺少 Level ID" });
    if (!learningSyncQueues[key]) learningSyncQueues[key] = { tail: Promise.resolve(), errors: {} };
    var queue = learningSyncQueues[key];

    var next = queue.tail.catch(function () {}).then(async function () {
      try {
        if (!window.AuthSystemModule || typeof window.AuthSystemModule.getCurrentSession !== "function") {
          return { ok: true, skipped: true, message: "目前沒有登入模組，僅保留本機紀錄。" };
        }
        var auth = await window.AuthSystemModule.getCurrentSession();
        if (!auth || !auth.user || !auth.user.id) {
          return { ok: true, skipped: true, message: "訪客模式僅保留本機紀錄。" };
        }
        var client = window.sbClient;
        if (!client && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
          client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
          });
          window.sbClient = client;
        }
        if (!client) throw new Error("Supabase 用戶端尚未初始化");

        var type = log.stageType || (log.isRemedial ? "remedial" : "practice");
        var hint = /^H[1-4]$/.test(String(log.hintLevel || "")) ? Number(String(log.hintLevel).slice(1)) : 0;
        var response = await client.rpc("record_learning_answer", {
          p_chapter_id: log.chapterId || null,
          p_level_id: key,
          p_question_type: type,
          p_question_id: log.questionId,
          p_raw_answer: String(log.studentAnswer == null ? "" : log.studentAnswer),
          p_is_correct: Boolean(log.isCorrect),
          p_concept_id: type === "remedial" ? (log.errorCode || null) : (log.subConcept || null),
          p_sub_step: null,
          p_hint_count: hint,
          p_ai_reason: log.errorCode || log.verdict || null
        });
        if (response && response.error) throw new Error(response.error.message || "作答紀錄同步失敗");
        delete queue.errors[String(log.questionId || "") + "::" + String(type === "remedial" ? (log.errorCode || "") : "")];
        window.dispatchEvent(new CustomEvent("star-learning:answer-synced", {
          detail: { levelId: key, questionId: log.questionId, result: response ? response.data : null }
        }));
        return { ok: true, data: response ? response.data : null };
      } catch (error) {
        var message = error && error.message ? error.message : "未知同步錯誤";
        queue.errors[String(log.questionId || "") + "::" + String(type === "remedial" ? (log.errorCode || "") : "")] = message;
        window.dispatchEvent(new CustomEvent("star-learning:sync-error", {
          detail: { levelId: key, questionId: log.questionId, message: message }
        }));
        return { ok: false, message: message };
      }
    });
    queue.tail = next;
    return next;
  }

  async function flushLearningSync(levelId) {
    var queue = learningSyncQueues[String(levelId || "")];
    if (!queue) return { ok: true };
    await queue.tail;
    var pendingErrors = Object.values(queue.errors);
    if (pendingErrors.length) {
      var message = Array.from(new Set(pendingErrors)).join("；");
      return { ok: false, message: message };
    }
    return { ok: true };
  }


  function esc(x) {
    return String(x || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMathForStudent(rawText) {
    var s = esc(String(rawText || ""));

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

    s = s.replace(/([A-Za-z0-9_()+\-×·]+)\/([A-Za-z0-9_()+\-×·]+)/g, function (_, num, den) {
      return (
        "<span class=\"math-frac math-expr\">" +
        "<span class=\"math-num\">" + num + "</span>" +
        "<span class=\"math-den\">" + den + "</span>" +
        "</span>"
      );
    });

    s = s.replace(/_\{([^}]+)\}/g, "<sub class=\"math-expr\">$1</sub>");
    s = s.replace(/_([A-Za-z0-9])/g, "<sub class=\"math-expr\">$1</sub>");
    s = s.replace(/\^\{([^}]+)\}/g, "<sup class=\"math-expr\">$1</sup>");
    s = s.replace(/\^([+\-]?[A-Za-z0-9]+)/g, "<sup class=\"math-expr\">$1</sup>");
    s = s.replace(/\n/g, "<br>");
    return "<span class=\"math-expr\">" + s + "</span>";
  }

  function makeLesson(cfg) {
    return {
      motivation: cfg.motivation || "",
      intuition: cfg.intuition || "",
      diagramSvg: cfg.diagramSvg || "",
      diagramCaption: cfg.diagramCaption || "",
      definition: cfg.definition || "",
      derivation: cfg.derivation || "",
      conditions: cfg.conditions || "",
      example: cfg.example || "",
      pitfalls: cfg.pitfalls || "",
      extension: cfg.extension || ""
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
        var badOdd = (low.indexOf("奇數") !== -1 && low.indexOf("正") !== -1 && low.indexOf("奇數次方是負") === -1 && low.indexOf("奇數次方為負") === -1 && low.indexOf("奇數次方負") === -1);
        var badEven = (low.indexOf("偶數") !== -1 && low.indexOf("負") !== -1 && low.indexOf("偶數次方是正") === -1 && low.indexOf("偶數次方為正") === -1 && low.indexOf("偶數次方正") === -1);
        if (badOdd || badEven) {
          return resObj("incorrect", false, "E02", { contextKey: "contradiction_sign" });
        }
        var oddNeg = (low.indexOf("奇") !== -1 && low.indexOf("負") !== -1) || low.indexOf("-8") !== -1;
        var evenPos = (low.indexOf("偶") !== -1 && low.indexOf("正") !== -1) || low.indexOf("16") !== -1;
        if (oddNeg && evenPos) return resObj("pass", true, null);
        return resObj("partial", false, "E05", { supplementPrompt: "請補充說明奇數次方與偶數次方各自的正負號規律，以及括號的影響。" });
      }
      if (p.nodeId === "M1-02") {
        var incZero = low.indexOf("包括 0") !== -1 || low.indexOf("包括0") !== -1 || low.indexOf("0 的 0 次方") !== -1 || low.indexOf("0的0次方") !== -1;
        if (incZero) return resObj("incorrect", false, "E03", { contextKey: "zero_power_includes_zero" });
        var hasDiv = low.indexOf("除") !== -1 || low.indexOf("相減") !== -1 || low.indexOf("自己") !== -1 || low.indexOf("相同") !== -1;
        var hasOne = low.indexOf("1") !== -1 || low.indexOf("一") !== -1;
        var hasNonZero = low.indexOf("不為 0") !== -1 || low.indexOf("不為0") !== -1 || low.indexOf("非零") !== -1 || low.indexOf("≠") !== -1 || low.indexOf("不能為 0") !== -1 || low.indexOf("不能為0") !== -1;
        if (hasDiv && hasOne && hasNonZero) return resObj("pass", true, null);
        if (hasDiv && hasOne && !hasNonZero) {
          return resObj("partial", false, "E03", { supplementPrompt: "你提到相除與 1 的關係，請再補充「底數不能為 0」的條件。" });
        }
        return resObj("partial", false, "E05", { supplementPrompt: "請說明同底數相除或相同非零數相除為 1 的原因，並注意底數不可為 0。" });
      }
      var hasReason = raw.length >= 6 && (
        raw.indexOf("因為") !== -1 || raw.indexOf("所以") !== -1 || raw.indexOf("平方") !== -1 ||
        raw.indexOf("斜率") !== -1 || raw.indexOf("半徑") !== -1 || raw.indexOf("距離") !== -1 ||
        raw.indexOf("圓心") !== -1 || raw.indexOf("交點") !== -1 || raw.indexOf("正") !== -1 ||
        raw.indexOf("負") !== -1 || raw.indexOf("0") !== -1 || raw.indexOf("相等") !== -1 ||
        raw.indexOf("分母") !== -1 || raw.indexOf("除") !== -1 || raw.indexOf("代入") !== -1 ||
        raw.indexOf("項") !== -1
      );
      if (hasReason) return resObj("pass", true, null);
      return resObj("partial", false, "E05", { supplementPrompt: "請用較完整的句子說明「為什麼」（例如寫出對應的幾何關係、代數條件或理由）。" });
    }
  };

  function makeIntValidator(expectedStr, altWrongList, altWrongCode) {
    return function (v) {
      var t = String(v || "").trim().replace(/^\+/, "");
      if (!t) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入計算結果。" });
      if (!/^[\+\-]?\d+$/.test(t)) return resObj("unclear", false, "E05", { supplementPrompt: "請輸入整數數值。" });
      if (t === expectedStr) return resObj("pass", true, null);
      if (altWrongList && altWrongList.indexOf(t) !== -1) return resObj("incorrect", false, altWrongCode || "E02");
      return resObj("incorrect", false, "E04");
    };
  }

  var CHAPTERS = {
    "CH-1": {
      chapterId: "CH-1",
      chapterNumber: 1,
      title: "數與式",
      galaxyStyle: "nebula-amber-blue",
      summaryTitle: "Chapter 1（數與式）單元總結",
      summaryKeyConcepts: [
        "正整數次方 a^n 代表相同底數連續相乘 n 次；負數底數偶數次方為正、奇數次方為負。",
        "零次方 a^0 = 1 的前提是底數 a ≠ 0（0^0 不在一般規定內）。"
      ]
    },
    "CH-2": {
      chapterId: "CH-2",
      chapterNumber: 2,
      title: "直線與圓",
      galaxyStyle: "nebula-default",
      summaryTitle: "Chapter 2（直線與圓）單元總結",
      summaryKeyConcepts: [
        "兩點距離公式 AB = sqrt((x_2 - x_1)^2 + (y_2 - y_1)^2) 源自直角三角形畢氏定理。",
        "斜率 m = (y_2 - y_1)/(x_2 - x_1) 需 x_1 ≠ x_2；鉛直線因分母為 0 且除以零無定義故無斜率。",
        "圓的標準式為 (x - h)^2 + (y - k)^2 = r^2（r > 0）；比較圓心到直線距離 d 與半徑 r 可判別位置關係。"
      ]
    },
    "CH-3": {
      chapterId: "CH-3",
      chapterNumber: 3,
      title: "多項式",
      galaxyStyle: "nebula-violet-teal",
      summaryTitle: "Chapter 3（多項式）單元總結",
      summaryKeyConcepts: [
        "多項式加減時須合併同次方項；代入求值時需注意次方與正負號。",
        "多項式 f(x) 除以 (x - a) 的餘式為 f(a)；當 f(a) = 0 時，(x - a) 為 f(x) 的因式。"
      ]
    }
  };

  var QUESTION_BANK = [
    { id: "QB-CH1-L1-1", chapterId: "CH-1", levelId: "CH1-L1", subConcept: "正整數次方連乘定義", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】計算 2^3 + (-3)^2 的值。（填整數）", standardAnswer: "17", acceptableAnswers: ["17"], steps: ["2^3 = 8", "(-3)^2 = 9", "8 + 9 = 17"], gradingRule: "數值需為 17", commonErrors: ["E02", "E04"], supplementNote: "正整數次方是連乘不是相乘；負數偶數次方為正。", active: true },
    { id: "QB-CH1-L1-2", chapterId: "CH-1", levelId: "CH1-L1", subConcept: "負數奇偶次方正負號與括號", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】計算 2^2 + (-2)^3 的值。（填整數）", standardAnswer: "-4", acceptableAnswers: ["-4"], steps: ["2^2 = 4", "(-2)^3 = -8", "4 + (-8) = -4"], gradingRule: "數值需為 -4", commonErrors: ["E02", "E04"], supplementNote: "(-2)^3 是三個 -2 連乘，結果為 -8。", active: true },
    { id: "QB-CH1-L2-1", chapterId: "CH-1", levelId: "CH1-L2", subConcept: "零次方規定 a^0 = 1（a ≠ 0）", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】計算 (-6)^0 + 2^3 - 5^0 的值。（填整數）", standardAnswer: "8", acceptableAnswers: ["8"], steps: ["(-6)^0 = 1", "2^3 = 8", "5^0 = 1", "1 + 8 - 1 = 8"], gradingRule: "數值需為 8", commonErrors: ["E01", "E04"], supplementNote: "非零數的零次方為 1，不是 0。", active: true },
    { id: "QB-CH1-L2-2", chapterId: "CH-1", levelId: "CH1-L2", subConcept: "底數不可為 0 的限制", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】原有 3 組，加上 6^0 組，共有幾組？（填整數）", standardAnswer: "4", acceptableAnswers: ["4"], steps: ["6^0 = 1", "3 + 1 = 4"], gradingRule: "數值需為 4", commonErrors: ["E06", "E04"], supplementNote: "先看清楚題目問的是「組數」還是「人數」。", active: true },
    { id: "QB-CH2-L1-1", chapterId: "CH-2", levelId: "CH2-L1", subConcept: "平面兩點距離公式", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】求點 (-2, 1) 與點 (2, 4) 之間的距離。（填整數）", standardAnswer: "5", acceptableAnswers: ["5"], steps: ["|2 - (-2)| = 4", "|4 - 1| = 3", "sqrt(4^2 + 3^2) = 5"], gradingRule: "數值需為 5", commonErrors: ["E04", "E01"], supplementNote: "先算水平差與鉛直差，平方和再開根號。", active: true },
    { id: "QB-CH2-L1-2", chapterId: "CH-2", levelId: "CH2-L1", subConcept: "水平與鉛直坐標差", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】兩點水平距離 12、鉛直距離 5，連線段長為多少？（填整數）", standardAnswer: "13", acceptableAnswers: ["13"], steps: ["12^2 + 5^2 = 169", "sqrt(169) = 13"], gradingRule: "數值需為 13", commonErrors: ["E04", "E06"], supplementNote: "水平與鉛直位移垂直，可用畢氏定理求斜邊。", active: true },
    { id: "QB-CH2-L2-1", chapterId: "CH-2", levelId: "CH2-L2", subConcept: "斜率定義與兩點公式", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】求通過點 (2, 5) 與點 (6, -3) 的直線斜率。（填整數）", standardAnswer: "-2", acceptableAnswers: ["-2"], steps: ["分子：-3 - 5 = -8", "分母：6 - 2 = 4", "m = -8/4 = -2"], gradingRule: "數值需為 -2", commonErrors: ["E04", "E02"], supplementNote: "斜率是 y 變化量除以 x 變化量，分子與分母相減順序須一致。", active: true },
    { id: "QB-CH2-L2-2", chapterId: "CH-2", levelId: "CH2-L2", subConcept: "鉛直線因分母為 0 故無斜率", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】通過 (0, 1) 與 (4, 9) 的直線斜率為多少？（填整數）", standardAnswer: "2", acceptableAnswers: ["2"], steps: ["分子：9 - 1 = 8", "分母：4 - 0 = 4", "m = 8/4 = 2"], gradingRule: "數值需為 2", commonErrors: ["E04", "E06"], supplementNote: "高度差除以水平差即為平均斜率。", active: true },
    { id: "QB-CH2-L3-1", chapterId: "CH-2", levelId: "CH2-L3", subConcept: "點坐標代入檢驗", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】直線 y = 2x + 3 上，當 x = 4 時對應的 y 值為多少？（填整數）", standardAnswer: "11", acceptableAnswers: ["11"], steps: ["代入 x = 4", "y = 2(4) + 3 = 11"], gradingRule: "數值需為 11", commonErrors: ["E04", "E01"], supplementNote: "將 x 值代入直線方程式計算對應 y 值。", active: true },
    { id: "QB-CH2-L3-2", chapterId: "CH-2", levelId: "CH2-L3", subConcept: "點斜式與直線關係", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】費用公式 y = 15x + 20，當 x = 2 時 y 為多少？（填整數）", standardAnswer: "50", acceptableAnswers: ["50"], steps: ["20 + 15 × 2 = 50"], gradingRule: "數值需為 50", commonErrors: ["E06", "E04"], supplementNote: "基本費加上每小時費用乘以時數。", active: true },
    { id: "QB-CH2-L4-1", chapterId: "CH-2", levelId: "CH2-L4", subConcept: "圓的標準式 (x - h)^2 + (y - k)^2 = r^2", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】半徑 r = 5 的圓，其標準式右邊常數 r^2 為多少？（填整數）", standardAnswer: "25", acceptableAnswers: ["25"], steps: ["r = 5", "r^2 = 25"], gradingRule: "數值需為 25", commonErrors: ["E02", "E04"], supplementNote: "圓標準式右邊是 r^2，不是 r。", active: true },
    { id: "QB-CH2-L4-2", chapterId: "CH-2", levelId: "CH2-L4", subConcept: "圓心與半徑幾何意義", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】半徑 r = 7 的圓，其標準式右邊 r^2 為多少？（填整數）", standardAnswer: "49", acceptableAnswers: ["49"], steps: ["r = 7", "r^2 = 49"], gradingRule: "數值需為 49", commonErrors: ["E04", "E06"], supplementNote: "半徑 7 對應標準式右邊常數為 7^2 = 49。", active: true },
    { id: "QB-CH2-L5-1", chapterId: "CH-2", levelId: "CH2-L5", subConcept: "圓心到直線距離 d 與半徑 r 比較", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】已知圓半徑 r = 10，圓心到直線距離 d = 6，求 r - d。（填整數）", standardAnswer: "4", acceptableAnswers: ["4"], steps: ["r = 10, d = 6", "r - d = 4"], gradingRule: "數值需為 4", commonErrors: ["E04", "E01"], supplementNote: "d < r 時直線與圓相交兩點。", active: true },
    { id: "QB-CH2-L5-2", chapterId: "CH-2", levelId: "CH2-L5", subConcept: "相交、相切與不相交判準", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】已知 r = 9、d = 4，求 r - d。（填整數）", standardAnswer: "5", acceptableAnswers: ["5"], steps: ["9 - 4 = 5"], gradingRule: "數值需為 5", commonErrors: ["E04", "E06"], supplementNote: "比較半徑與圓心到直線距離。", active: true },
    { id: "QB-CH2-L6-1", chapterId: "CH-2", levelId: "CH2-L6", subConcept: "點與圓位置判讀", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】點到圓心距離平方為 13，半徑平方為 25，求 25 - 13。（填整數）", standardAnswer: "12", acceptableAnswers: ["12"], steps: ["25 - 13 = 12"], gradingRule: "數值需為 12", commonErrors: ["E04", "E01"], supplementNote: "先比較距離平方與半徑平方。", active: true },
    { id: "QB-CH2-L6-2", chapterId: "CH-2", levelId: "CH2-L6", subConcept: "坐標與圓綜合解題", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】點 (0, 0) 到點 (0, 8) 的距離為多少？（填整數）", standardAnswer: "8", acceptableAnswers: ["8"], steps: ["(0, 0) 到 (0, 8) 距離為 8"], gradingRule: "數值需為 8", commonErrors: ["E06", "E04"], supplementNote: "同一軸上兩點距離為坐標差的絕對值。", active: true },
    { id: "QB-CH3-L1-1", chapterId: "CH-3", levelId: "CH3-L1", subConcept: "多項式代入求值", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】設 f(x) = x^2 + 2x + 1，求 f(2) 的值。（填整數）", standardAnswer: "9", acceptableAnswers: ["9"], steps: ["f(2) = 2^2 + 2(2) + 1 = 4 + 4 + 1 = 9"], gradingRule: "數值需為 9", commonErrors: ["E04", "E01"], supplementNote: "將 x = 2 逐項代入計算。", active: true },
    { id: "QB-CH3-L1-2", chapterId: "CH-3", levelId: "CH3-L1", subConcept: "多項式項次與係數", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】設 f(x) = 3x + 4，求 f(2) 的值。（填整數）", standardAnswer: "10", acceptableAnswers: ["10"], steps: ["3(2) + 4 = 10"], gradingRule: "數值需為 10", commonErrors: ["E04", "E02"], supplementNote: "先乘以 x 的係數再加上常數項。", active: true },
    { id: "QB-CH3-L2-1", chapterId: "CH-3", levelId: "CH3-L2", subConcept: "餘式定理 f(a)", difficulty: "基礎", type: "integer", prompt: "【刷題練習 1/2】f(x) = x + 4 除以 (x - 1) 的餘數是多少？（填整數）", standardAnswer: "5", acceptableAnswers: ["5"], steps: ["f(1) = 1 + 4 = 5"], gradingRule: "數值需為 5", commonErrors: ["E04", "E02"], supplementNote: "除以 (x - 1) 的餘式為 f(1)。", active: true },
    { id: "QB-CH3-L2-2", chapterId: "CH-3", levelId: "CH3-L2", subConcept: "因式定理判別", difficulty: "進階", type: "integer", prompt: "【刷題練習 2/2】f(x) = 2x + 6 除以 (x - 1) 的餘數是多少？（填整數）", standardAnswer: "8", acceptableAnswers: ["8"], steps: ["f(1) = 2(1) + 6 = 8"], gradingRule: "數值需為 8", commonErrors: ["E04", "E02"], supplementNote: "代入 x = 1 計算 f(1)。", active: true }
  ];

  var FALLBACK_PRACTICE_Q = {
    id: "QB-FALLBACK-1",
    subConcept: "基礎運算與觀念檢驗",
    difficulty: "基礎",
    prompt: "【刷題練習】計算 3^2 + 4^2 的值。（填整數）",
    standardAnswer: "25",
    acceptableAnswers: ["25"],
    commonErrors: ["E04"],
    supplementNote: "3^2 = 9，4^2 = 16，9 + 16 = 25。"
  };

  var REMEDIAL_BANK = {
    E01: [
      { prompt: "【加強第 1 步・定義釐清】若某數的定義是「底數不為 0 時，零次方等於 1」，則 9^0 等於多少？（填整數）", answer: "1" },
      { prompt: "【加強第 2 步・觀念應用】若圓的半徑 r = 6，圓心到直線距離 d = 6（相切），共有幾個交點？（填整數）", answer: "1" }
    ],
    E02: [
      { prompt: "【加強第 1 步・性質與括號】計算 (-3)^2 的值（負數偶數次方為正）。（填整數）", answer: "9" },
      { prompt: "【加強第 2 步・標準式判讀】若半徑 r = 4，圓標準式右邊 r^2 為多少？（填整數）", answer: "16" }
    ],
    E03: [
      { prompt: "【加強第 1 步・條件檢核】在 (x - 3)^0 = 1 中，x 不能等於哪一個數？（填整數）", answer: "3" },
      { prompt: "【加強第 2 步・分母條件】若兩點 x 坐標皆為 2，x 坐標差 x_2 - x_1 為多少？（填整數）", answer: "0" }
    ],
    E04: [
      { prompt: "【加強第 1 步・基礎計算】計算 8 + 9 的值。（填整數）", answer: "17" },
      { prompt: "【加強第 2 步・綜合計算】計算 12 + 5 的值。（填整數）", answer: "17" }
    ],
    E05: [
      { prompt: "【加強第 1 步・推論拆解】計算 3^2 + 4^2 的值。（填整數）", answer: "25" },
      { prompt: "【加強第 2 步・開根號推論】若兩點距離平方為 25（正數），兩點距離為多少？（填整數）", answer: "5" }
    ],
    E06: [
      { prompt: "【加強第 1 步・題意拆解】原有 3 組，新增 1 組，共有幾組？（填整數）", answer: "4" },
      { prompt: "【加強第 2 步・情境建模】每小時 15 元，2 小時共多少元？（填整數）", answer: "30" }
    ],
    E07: [
      { prompt: "【加強第 1 步・細心核對】計算 10 - 6 的值。（填整數）", answer: "4" },
      { prompt: "【加強第 2 步・細心核對】計算 25 - 13 的值。（填整數）", answer: "12" }
    ]
  };

  var LEVELS = [
    {
      levelId: "CH1-L1", chapterId: "CH-1", levelNumber: 1, title: "正整數次方", legacyNodeId: "M1-01",
      planetStyle: "planet-crater-amber", orbitOrder: 1,
      subConcepts: ["正整數次方連乘定義", "負數奇偶次方正負號與括號"],
      lesson: makeLesson({
        motivation: "在科學記號與幾何面積計算中，常需要把相同的數連續相乘，寫成次方可以讓式子更精簡。",
        intuition: "a^n 代表把 a 連續乘 n 次，不是把 a 乘以 n。",
        diagramSvg: "<svg viewBox=\"0 0 240 90\" width=\"240\" height=\"90\" aria-label=\"次方連乘示意圖\"><rect x=\"18\" y=\"22\" width=\"56\" height=\"44\" rx=\"6\" fill=\"rgba(56,189,248,0.18)\" stroke=\"#38BDF8\"/><text x=\"46\" y=\"49\" text-anchor=\"middle\" fill=\"#F8FAFC\" font-size=\"13\">2^2 = 4</text><text x=\"155\" y=\"49\" text-anchor=\"middle\" fill=\"#FDE68A\" font-size=\"13\">(-2)^3 = -8</text></svg>",
        diagramCaption: "圖示：次方看連乘次數；負數底數需留意奇偶次方與括號。",
        definition: "當 n 為正整數、a 為實數時，a^n 表示 a 連續相乘 n 次。",
        derivation: "由乘法結合律，n 個 a 相乘記為 a^n；當 a < 0 時，偶數個負數相乘為正，奇數個負數相乘為負。",
        conditions: "次方指數 n 為正整數（n = 1, 2, 3, ...）。",
        example: "計算 2^3 + (-3)^2：2^3 = 8，(-3)^2 = 9，相加得 17。",
        pitfalls: "把 2^3 誤算成 2 × 3 = 6，或把 -3^2 與 (-3)^2 混淆。",
        extension: "正整數次方規律可延伸至零次方與後續指數律。"
      }),
      guide: { questionId: "CH1-L1-G", dimension: "推理能力", prompt: "請用自己的話說明：為什麼 (-2)^3 與 (-2)^4 的正負號不同？" },
      checkQuestions: [
        { questionId: "CH1-L1-C1", subConcept: "負數奇偶次方正負號與括號", dimension: "概念理解", prompt: "【理解檢查 1/2】下列哪一個算式與 -5^2 相等？（填 A、B 或 C）\nA. (-5)^2\nB. -(5 × 5)\nC. (-5) × 2", expected: "B", validate: function (v) { var u = String(v || "").trim().toUpperCase(); if (!u) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入 A、B 或 C。" }); if (u === "B") return resObj("pass", true, null); if (u === "A") return resObj("incorrect", false, "E02", { contextKey: "contradiction_sign" }); if (u === "C") return resObj("incorrect", false, "E01"); return resObj("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C。" }); } },
        { questionId: "CH1-L1-C2", subConcept: "正整數次方連乘定義", dimension: "基礎運算", prompt: "【理解檢查 2/2】計算 2^3 + (-3)^2 的值。（填整數）", expected: "17", validate: makeIntValidator("17", ["-1", "1", "-17"], "E02") }
      ],
      hints: { H1: "先確認次方是連乘次數，並留意括號範圍。", H2: "2^3 = 8，(-3)^2 = 9。", H3: "8 + 9 = 17。", H4: "答案為 17。" }
    },
    {
      levelId: "CH1-L2", chapterId: "CH-1", levelNumber: 2, title: "零次方", legacyNodeId: "M1-02",
      planetStyle: "planet-ring-cyan", orbitOrder: 2,
      subConcepts: ["零次方規定 a^0 = 1（a ≠ 0）", "底數不可為 0 的限制"],
      lesson: makeLesson({
        motivation: "在指數運算中，當同底數相除且指數相減為 0 時，a^0 應該代表什麼數才合理？",
        intuition: "同一個非零數自己除以自己等於 1，配合同底數相除指數相減，a^0 規定為 1。",
        diagramSvg: "<svg viewBox=\"0 0 240 85\" width=\"240\" height=\"85\" aria-label=\"零次方規則示意圖\"><text x=\"120\" y=\"36\" text-anchor=\"middle\" fill=\"#38BDF8\" font-size=\"14\">a^0 = 1（當 a ≠ 0）</text><text x=\"120\" y=\"62\" text-anchor=\"middle\" fill=\"#FCA5A5\" font-size=\"12\">注意：底數不可為 0</text></svg>",
        diagramCaption: "圖示：非零底數的零次方為 1；底數為 0 須留意條件限制。",
        definition: "當實數 a ≠ 0 時，規定 a^0 = 1。",
        derivation: "對於 a ≠ 0 與正整數 n，a^n / a^n = 1，若依指數相減規則 a^(n - n) = a^0，故規定 a^0 = 1。",
        conditions: "底數必須不為 0（a ≠ 0）。",
        example: "計算 (-6)^0 + 2^3 - 5^0：(-6)^0 = 1，2^3 = 8，5^0 = 1，1 + 8 - 1 = 8。",
        pitfalls: "把 a^0 誤算成 0，或忽略 (x - 3)^0 成立時 x ≠ 3。",
        extension: "零次方與正整數次方共同構成後續負整數次方的推導基礎。"
      }),
      guide: { questionId: "CH1-L2-G", dimension: "推理能力", prompt: "請說明：為什麼非零數的 0 次方會規定為 1 而不是 0？並說明底數有什麼限制。" },
      checkQuestions: [
        { questionId: "CH1-L2-C1", subConcept: "底數不可為 0 的限制", dimension: "概念理解", prompt: "【理解檢查 1/2】若 (x - 3)^0 = 1 成立，x 必須滿足什麼條件？（填 A、B 或 C）\nA. 任意實數\nB. x ≠ 3\nC. x > 3", expected: "B", validate: function (v) { var u = String(v || "").trim().toUpperCase(); if (!u) return resObj("unclear", false, "E06", { supplementPrompt: "請輸入 A、B 或 C。" }); if (u === "B") return resObj("pass", true, null); if (u === "A") return resObj("incorrect", false, "E03", { contextKey: "zero_power_includes_zero" }); if (u === "C") return resObj("incorrect", false, "E07"); return resObj("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C。" }); } },
        { questionId: "CH1-L2-C2", subConcept: "零次方規定 a^0 = 1（a ≠ 0）", dimension: "基礎運算", prompt: "【理解檢查 2/2】計算 (-6)^0 + 2^3 - 5^0 的值。（填整數）", expected: "8", validate: makeIntValidator("8", ["7", "2", "0"], "E01") }
      ],
      hints: { H1: "非零數的零次方等於 1。", H2: "1 + 8 - 1 = 8。", H3: "結果為 8。", H4: "答案為 8。" }
    },
    {
      levelId: "CH2-L1", chapterId: "CH-2", levelNumber: 1, title: "坐標平面與點的關係", legacyNodeId: "LC-01",
      planetStyle: "planet-crater-amber", orbitOrder: 1,
      subConcepts: ["水平與鉛直坐標差", "平面兩點距離公式"],
      lesson: makeLesson({
        motivation: "在平面上定位兩點後，如何求兩點間的直線距離？",
        intuition: "把水平差與鉛直差當成直角三角形的兩股，連線段長就是斜邊。",
        diagramSvg: "<svg viewBox=\"0 0 240 105\" width=\"240\" height=\"105\" aria-label=\"兩點距離直角三角形示意圖\"><line x1=\"35\" y1=\"82\" x2=\"175\" y2=\"82\" stroke=\"#38BDF8\" stroke-width=\"2.2\"/><line x1=\"175\" y1=\"82\" x2=\"175\" y2=\"26\" stroke=\"#2DD4BF\" stroke-width=\"2.2\"/><line x1=\"35\" y1=\"82\" x2=\"175\" y2=\"26\" stroke=\"#F8FAFC\" stroke-width=\"2.2\"/><text x=\"86\" y=\"98\" fill=\"#38BDF8\" font-size=\"11\">|x_2 - x_1|</text><text x=\"181\" y=\"58\" fill=\"#2DD4BF\" font-size=\"11\">|y_2 - y_1|</text></svg>",
        diagramCaption: "圖示：利用直角三角形斜邊計算兩點距離。",
        definition: "平面上兩點 A(x_1, y_1)、B(x_2, y_2) 的距離為 AB = sqrt((x_2 - x_1)^2 + (y_2 - y_1)^2)。",
        derivation: "水平差為 |x_2 - x_1|、鉛直差為 |y_2 - y_1|，兩股互相垂直，依畢氏定理開根號即得距離公式。",
        conditions: "適用於平面直角坐標系中任意兩實數坐標點。",
        example: "點 (-2, 1) 與 (2, 4) 的距離：水平差 4、鉛直差 3，sqrt(4^2 + 3^2) = 5。",
        pitfalls: "忘記平方後再開根號，或直接把坐標相加。",
        extension: "兩點距離公式是推導圓的標準式之重要基礎。"
      }),
      guide: { questionId: "CH2-L1-G", dimension: "推理能力", prompt: "請說明：為什麼兩點距離公式中把 x 坐標差與 y 坐標差平方後，結果不會是負數？" },
      checkQuestions: [
        { questionId: "CH2-L1-C1", subConcept: "平面兩點距離公式", dimension: "概念理解", prompt: "【理解檢查 1/2】兩點水平距離 6、鉛直距離 8，連線段長為多少？（填整數）", expected: "10", validate: makeIntValidator("10", ["14", "2"], "E01") },
        { questionId: "CH2-L1-C2", subConcept: "水平與鉛直坐標差", dimension: "基礎運算", prompt: "【理解檢查 2/2】計算點 (-2, 1) 與點 (2, 4) 的距離。（填整數）", expected: "5", validate: makeIntValidator("5", ["7", "1"], "E04") }
      ],
      hints: { H1: "先找水平差與鉛直差。", H2: "平方和為 4^2 + 3^2 = 25。", H3: "sqrt(25) = 5。", H4: "距離為 5。" }
    },
    {
      levelId: "CH2-L2", chapterId: "CH-2", levelNumber: 2, title: "直線的斜率", legacyNodeId: "LC-02",
      planetStyle: "planet-ring-violet", orbitOrder: 2,
      subConcepts: ["斜率定義與兩點公式", "鉛直線因分母為 0 故無斜率"],
      lesson: makeLesson({
        motivation: "用一個數值清楚描述直線在坐標平面上的傾斜程度。",
        intuition: "斜率衡量鉛直變化量與水平變化量的比值。",
        diagramSvg: "<svg viewBox=\"0 0 240 105\" width=\"240\" height=\"105\" aria-label=\"斜率與鉛直線示意圖\"><line x1=\"24\" y1=\"86\" x2=\"114\" y2=\"28\" stroke=\"#38BDF8\" stroke-width=\"2.2\"/><line x1=\"180\" y1=\"18\" x2=\"180\" y2=\"88\" stroke=\"#F87171\" stroke-width=\"2.2\" stroke-dasharray=\"4 3\"/><text x=\"32\" y=\"22\" fill=\"#38BDF8\" font-size=\"11\">斜直線</text><text x=\"152\" y=\"101\" fill=\"#FCA5A5\" font-size=\"11\">鉛直線：無斜率</text></svg>",
        diagramCaption: "圖示：鉛直線任意兩點 x 坐標相同，分母為 0。",
        definition: "相異兩點 A(x_1, y_1)、B(x_2, y_2)（x_1 ≠ x_2）的連線斜率為 m = (y_2 - y_1)/(x_2 - x_1)。",
        derivation: "第一步：斜率代表鉛直變化量 (y_2 - y_1) 與水平變化量 (x_2 - x_1) 的比值。\n第二步：公式為 m = (y_2 - y_1)/(x_2 - x_1)。\n第三步：鉛直線取 A(2, 1)、B(2, 5)。\n第四步：代入得 (5 - 1)/(2 - 2) = 4/0。\n第五步：數學上除以零沒有定義。\n第六步：一般鉛直線任意兩點 x 坐標相同，分母必為 0，故斜率不存在。",
        conditions: "x_1 ≠ x_2 時斜率存在；水平線斜率為 0；鉛直線斜率不存在。",
        example: "通過 (2, 5) 與 (6, -3) 的直線斜率：(-3 - 5)/(6 - 2) = -8/4 = -2。",
        pitfalls: "分子與分母減法順序不一致，或把鉛直線斜率寫成 0。",
        extension: "斜率是建立直線方程式與判斷平行的重要工具。"
      }),
      guide: { questionId: "CH2-L2-G", dimension: "推理能力", prompt: "請依序說明：為什麼鉛直線沒有斜率？（請提到變化量比值、代入例子、除以零沒有定義與分母為零）" },
      checkQuestions: [
        { questionId: "CH2-L2-C1", subConcept: "鉛直線因分母為 0 故無斜率", dimension: "概念理解", prompt: "【理解檢查 1/2】水平線上任兩點 y 坐標相同，它的斜率是多少？（填整數）", expected: "0", validate: makeIntValidator("0", ["1"], "E01") },
        { questionId: "CH2-L2-C2", subConcept: "斜率定義與兩點公式", dimension: "基礎運算", prompt: "【理解檢查 2/2】求通過 (2, 5) 與 (6, -3) 的直線斜率。（填整數）", expected: "-2", validate: makeIntValidator("-2", ["2", "-8"], "E04") }
      ],
      hints: { H1: "分子是 y 變化量，分母是 x 變化量。", H2: "(-3 - 5)/(6 - 2) = -8/4。", H3: "-8 / 4 = -2。", H4: "斜率為 -2。" }
    },
    {
      levelId: "CH2-L3", chapterId: "CH-2", levelNumber: 3, title: "直線方程式", legacyNodeId: "LC-03",
      planetStyle: "planet-grid-blue", orbitOrder: 3,
      subConcepts: ["點斜式與直線關係", "點坐標代入檢驗"],
      lesson: makeLesson({
        motivation: "用代數方程式描述直線上所有點的共同規律。",
        intuition: "直線上任一點與定點連線的斜率等於直線斜率。",
        diagramSvg: "<svg viewBox=\"0 0 240 95\" width=\"240\" height=\"95\" aria-label=\"直線方程式示意圖\"><line x1=\"25\" y1=\"75\" x2=\"210\" y2=\"25\" stroke=\"#38BDF8\" stroke-width=\"2.2\"/><circle cx=\"75\" cy=\"61\" r=\"4\" fill=\"#F8FAFC\"/><circle cx=\"155\" cy=\"40\" r=\"4\" fill=\"#2DD4BF\"/><text x=\"55\" y=\"78\" fill=\"#F8FAFC\" font-size=\"11\">(x_0,y_0)</text><text x=\"145\" y=\"30\" fill=\"#2DD4BF\" font-size=\"11\">(x,y)</text></svg>",
        diagramCaption: "圖示：直線上任一點與定點滿足線性關係。",
        definition: "過點 (x_0, y_0) 且斜率為 m 的直線，點斜式為 y - y_0 = m(x - x_0)。",
        derivation: "由 (y - y_0)/(x - x_0) = m 兩邊同乘 (x - x_0) 得 y - y_0 = m(x - x_0)。",
        conditions: "點斜式適用於斜率 m 存在的直線；鉛直線另寫為 x = x_0。",
        example: "斜率 2 且過 (0, 1) 的直線為 y = 2x + 1；x = 4 時 y = 9。",
        pitfalls: "代入定點時漏改減號，或檢驗點時只看單一坐標。",
        extension: "直線方程式可與圓方程式聯立探討交點問題。"
      }),
      guide: { questionId: "CH2-L3-G", dimension: "推理能力", prompt: "請說明：如何判斷一個已知點 (a, b) 是否在某條直線方程式上？" },
      checkQuestions: [
        { questionId: "CH2-L3-C1", subConcept: "點坐標代入檢驗", dimension: "概念理解", prompt: "【理解檢查 1/2】直線 y = 3x - 2 中，當 x = 0 時 y 為多少？（填整數）", expected: "-2", validate: makeIntValidator("-2", ["2", "3"], "E01") },
        { questionId: "CH2-L3-C2", subConcept: "點斜式與直線關係", dimension: "基礎運算", prompt: "【理解檢查 2/2】直線 y = x + 5 中，當 x = 2 時 y 為多少？（填整數）", expected: "7", validate: makeIntValidator("7", ["3", "5"], "E04") }
      ],
      hints: { H1: "把 x 值代入方程式。", H2: "先乘除後加減。", H3: "2 + 5 = 7。", H4: "y = 7。" }
    },
    {
      levelId: "CH2-L4", chapterId: "CH-2", levelNumber: 4, title: "圓的基本概念與方程式", legacyNodeId: "LC-04",
      planetStyle: "planet-ring-cyan", orbitOrder: 4,
      subConcepts: ["圓心與半徑幾何意義", "圓的標準式 (x - h)^2 + (y - k)^2 = r^2"],
      lesson: makeLesson({
        motivation: "用代數方程式描述平面上到定點等距離的圓形圖形。",
        intuition: "圓上任一點到圓心距離都等於半徑 r。",
        diagramSvg: "<svg viewBox=\"0 0 240 105\" width=\"240\" height=\"105\" aria-label=\"圓標準式示意圖\"><circle cx=\"110\" cy=\"54\" r=\"34\" fill=\"none\" stroke=\"#38BDF8\" stroke-width=\"2.2\"/><line x1=\"110\" y1=\"54\" x2=\"144\" y2=\"54\" stroke=\"#2DD4BF\" stroke-width=\"2.2\"/><circle cx=\"110\" cy=\"54\" r=\"3\" fill=\"#F8FAFC\"/><text x=\"76\" y=\"48\" fill=\"#F8FAFC\" font-size=\"11\">(h,k)</text><text x=\"120\" y=\"47\" fill=\"#2DD4BF\" font-size=\"11\">r</text></svg>",
        diagramCaption: "圖示：圓心 (h, k) 到圓上任一點距離恆為 r。",
        definition: "圓心 (h, k)、半徑 r（r > 0）的圓標準式為 (x - h)^2 + (y - k)^2 = r^2。",
        derivation: "由兩點距離公式 sqrt((x - h)^2 + (y - k)^2) = r 兩邊平方即得 (x - h)^2 + (y - k)^2 = r^2。",
        conditions: "r > 0；右邊常數為 r^2 而非 r。",
        example: "(x - 2)^2 + (y - 5)^2 = 16 的圓心為 (2, 5)，半徑 r = sqrt(16) = 4。",
        pitfalls: "把 r^2 直接當成半徑 r，或看錯圓心坐標正負號。",
        extension: "展開標準式可得圓的一般式。"
      }),
      guide: { questionId: "CH2-L4-G", dimension: "推理能力", prompt: "請說明：為什麼圓的標準式右邊是 r^2 且 r 必須大於 0？" },
      checkQuestions: [
        { questionId: "CH2-L4-C1", subConcept: "圓的標準式 (x - h)^2 + (y - k)^2 = r^2", dimension: "概念理解", prompt: "【理解檢查 1/2】圓 (x - 2)^2 + (y - 5)^2 = 16 的半徑 r 為多少？（填整數）", expected: "4", validate: makeIntValidator("4", ["16", "8"], "E02") },
        { questionId: "CH2-L4-C2", subConcept: "圓心與半徑幾何意義", dimension: "基礎運算", prompt: "【理解檢查 2/2】半徑為 3 的圓，其標準式右邊 r^2 為多少？（填整數）", expected: "9", validate: makeIntValidator("9", ["3", "6"], "E04") }
      ],
      hints: { H1: "右邊常數是 r^2。", H2: "3 的平方是 3 × 3。", H3: "3 × 3 = 9。", H4: "r^2 = 9。" }
    },
    {
      levelId: "CH2-L5", chapterId: "CH-2", levelNumber: 5, title: "直線與圓的位置關係", legacyNodeId: "LC-05",
      planetStyle: "planet-grid-blue", orbitOrder: 5,
      subConcepts: ["圓心到直線距離 d 與半徑 r 比較", "相交、相切與不相交判準"],
      lesson: makeLesson({
        motivation: "判斷直線與圓是否有交點、有幾個交點。",
        intuition: "比較圓心到直線距離 d 與半徑 r 的大小。",
        definition: "d < r 相交兩點；d = r 相切一點；d > r 不相交。",
        derivation: "圓心到直線距離 d 為最短距離，與半徑 r 比較即可確定直線與圓的相對位置。",
        conditions: "r > 0，d ≥ 0，單位一致。",
        example: "r = 6、d = 6 時，d = r，兩者相切，交點數為 1。",
        pitfalls: "把相切（1 個交點）誤記為 2 個交點。",
        extension: "亦可透過聯立方程式判別式檢驗位置關係。"
      }),
      guide: { questionId: "CH2-L5-G", dimension: "推理能力", prompt: "請說明：當圓心到直線的距離 d 大於半徑 r 時，為什麼直線與圓沒有交點？" },
      checkQuestions: [
        { questionId: "CH2-L5-C1", subConcept: "相交、相切與不相交判準", dimension: "概念理解", prompt: "【理解檢查 1/2】當 r = 6、d = 6 時，直線與圓有幾個交點？（填整數）", expected: "1", validate: makeIntValidator("1", ["2", "0"], "E01") },
        { questionId: "CH2-L5-C2", subConcept: "圓心到直線距離 d 與半徑 r 比較", dimension: "基礎運算", prompt: "【理解檢查 2/2】當 r = 10、d = 6 時，r - d 為多少？（填整數）", expected: "4", validate: makeIntValidator("4", ["16", "-4"], "E04") }
      ],
      hints: { H1: "比較 d 與 r。", H2: "d = r 為相切。", H3: "10 - 6 = 4。", H4: "r - d = 4。" }
    },
    {
      levelId: "CH2-L6", chapterId: "CH-2", levelNumber: 6, title: "直線與圓的綜合應用", legacyNodeId: "LC-06",
      planetStyle: "planet-ring-violet", orbitOrder: 6,
      subConcepts: ["點與圓位置判讀", "坐標與圓綜合解題"],
      lesson: makeLesson({
        motivation: "整合坐標距離、直線與圓的性質解決綜合情境問題。",
        intuition: "先拆解已知條件，再選用距離或方程式工具。",
        definition: "綜合運用平面坐標、直線與圓性質進行幾何推論與計算。",
        derivation: "先求關鍵幾何量（如距離或半徑），再依定義作答。",
        conditions: "各公式與性質須符合其適用條件。",
        example: "圓心 (0, 0)、半徑 5 的圓，點 (3, 4) 到圓心距離為 sqrt(3^2 + 4^2) = 5，恰在圓上。",
        pitfalls: "混淆距離與坐標和，或漏看題目單位。",
        extension: "完成本關卡後可挑戰第二章最終評量與單元總結。"
      }),
      guide: { questionId: "CH2-L6-G", dimension: "推理能力", prompt: "請說明：要判斷一個點在圓內、圓上或圓外，應該比較哪兩個量？" },
      checkQuestions: [
        { questionId: "CH2-L6-C1", subConcept: "點與圓位置判讀", dimension: "概念理解", prompt: "【理解檢查 1/2】圓心 (0, 0)、半徑 5，點 (3, 4) 到圓心距離為多少？（填整數）", expected: "5", validate: makeIntValidator("5", ["7", "25"], "E01") },
        { questionId: "CH2-L6-C2", subConcept: "坐標與圓綜合解題", dimension: "基礎運算", prompt: "【理解檢查 2/2】距離平方 13、半徑平方 25，25 - 13 為多少？（填整數）", expected: "12", validate: makeIntValidator("12", ["38", "-12"], "E04") }
      ],
      hints: { H1: "先求點到圓心距離。", H2: "3^2 + 4^2 = 25，開根號得 5。", H3: "25 - 13 = 12。", H4: "差值為 12。" }
    },
    {
      levelId: "CH3-L1", chapterId: "CH-3", levelNumber: 1, title: "多項式的定義與運算", legacyNodeId: "PY-01",
      planetStyle: "planet-crater-amber", orbitOrder: 1,
      subConcepts: ["多項式項次與係數", "多項式代入求值"],
      lesson: makeLesson({
        motivation: "多項式是代數中最基礎的函數與運算模型，常用來描述變化規律。",
        intuition: "依 x 的次方由高到低排列，同類項才能合併加減。",
        definition: "由常數與 x 的非負整數次方透過加減乘組合而成的式子稱為 x 的多項式。",
        derivation: "將指定 x 值代入多項式各次方項計算後合併。",
        conditions: "次方須為非負整數。",
        example: "f(x) = x^2 + 2x + 1，f(2) = 4 + 4 + 1 = 9。",
        pitfalls: "不同次方項誤作同類項合併，或次方算錯。",
        extension: "多項式運算為除法原理與餘式定理奠定基礎。"
      }),
      guide: { questionId: "CH3-L1-G", dimension: "推理能力", prompt: "請說明：在多項式加減運算中，為什麼只有同次方項才能合併？" },
      checkQuestions: [
        { questionId: "CH3-L1-C1", subConcept: "多項式代入求值", dimension: "基礎運算", prompt: "【理解檢查 1/1】設 f(x) = x^2 + 3，求 f(2) 的值。（填整數）", expected: "7", validate: makeIntValidator("7", ["5", "6"], "E04") }
      ],
      hints: { H1: "先算 2^2。", H2: "4 + 3 = 7。", H3: "f(2) = 7。", H4: "代入 x = 2 得 7。" }
    },
    {
      levelId: "CH3-L2", chapterId: "CH-3", levelNumber: 2, title: "餘式定理與因式定理", legacyNodeId: "PY-02",
      planetStyle: "planet-ring-cyan", orbitOrder: 2,
      subConcepts: ["餘式定理 f(a)", "因式定理判別"],
      lesson: makeLesson({
        motivation: "不用做完整長除法，也能快速求出多項式除以一次式 (x - a) 的餘數。",
        intuition: "把除式令為 0 得到 x = a，代入 f(x) 即得餘式。",
        definition: "多項式 f(x) 除以 (x - a) 的餘式等於 f(a)；當 f(a) = 0 時，(x - a) 為 f(x) 的因式。",
        derivation: "由除法原理 f(x) = (x - a)q(x) + r，代入 x = a 得 r = f(a)。",
        conditions: "除式為一次式 x - a。",
        example: "f(x) = x + 4 除以 (x - 1) 的餘式為 f(1) = 1 + 4 = 5。",
        pitfalls: "把 x - a = 0 的解寫成 -a 而非 +a。",
        extension: "因式定理可用於多項式因式分解與方程式求解。"
      }),
      guide: { questionId: "CH3-L2-G", dimension: "推理能力", prompt: "請說明：為什麼多項式 f(x) 除以 (x - a) 的餘式會等於 f(a)？" },
      checkQuestions: [
        { questionId: "CH3-L2-C1", subConcept: "餘式定理 f(a)", dimension: "基礎運算", prompt: "【理解檢查 1/1】f(x) = 2x + 3 除以 (x - 1) 的餘數是多少？（填整數）", expected: "5", validate: makeIntValidator("5", ["3", "4"], "E04") }
      ],
      hints: { H1: "代入 x = 1。", H2: "2(1) + 3 = 5。", H3: "餘數為 5。", H4: "f(1) = 5。" }
    }
  ];

  var LEVEL_MAP = {};
  LEVELS.forEach(function (lv) { LEVEL_MAP[lv.levelId] = lv; });

  function getOrderedChapterStages(chapterId) {
    var chLvs = LEVELS.filter(function (l) { return l.chapterId === chapterId; })
      .sort(function (a, b) { return a.levelNumber - b.levelNumber; });
    var seq = [];
    chLvs.forEach(function (lv) {
      seq.push({
        key: lv.levelId + "::X-1",
        code: lv.levelNumber + "-1",
        stageCode: "X-1",
        levelId: lv.levelId,
        levelNumber: lv.levelNumber,
        levelTitle: lv.title,
        stageTitle: "觀念學習"
      });
      seq.push({
        key: lv.levelId + "::X-2",
        code: lv.levelNumber + "-2",
        stageCode: "X-2",
        levelId: lv.levelId,
        levelNumber: lv.levelNumber,
        levelTitle: lv.title,
        stageTitle: "刷題練習"
      });
    });
    return seq;
  }

  function isStageFormallyCompleted(ses, stageCode) {
    if (!ses || !Array.isArray(ses.logs)) return false;
    if (stageCode === "X-1") {
      var guidePassed = ses.logs.some(function (l) { return l.stageType === "guide" && l.isCorrect; });
      var checkPassed = ses.logs.some(function (l) { return l.stageType === "check" && l.isCorrect; });
      return Boolean(ses.stage1Completed && guidePassed && checkPassed);
    }
    if (stageCode === "X-2") {
      var pracOrRemPassed = ses.logs.some(function (l) {
        return (l.stageType === "practice" || l.stageType === "remedial") && l.isCorrect;
      });
      return Boolean(ses.stage2Completed && pracOrRemPassed);
    }
    return false;
  }

  var Repo = {
    loadAll: function () {
      try { var r = localStorage.getItem(STORE_KEY); var p = r ? JSON.parse(r) : {}; return p && typeof p === "object" ? p : {}; } catch (e) { return {}; }
    },
    saveAll: function (m) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(m)); } catch (e) {}
    },
    loadMasteryMap: function () {
      try { var r = localStorage.getItem(MASTERY_SYNC_KEY); var p = r ? JSON.parse(r) : {}; return p && typeof p === "object" ? p : {}; } catch (e) { return {}; }
    },
    saveMasteryMap: function (m) {
      try { localStorage.setItem(MASTERY_SYNC_KEY, JSON.stringify(m)); } catch (e) {}
    },
    getSession: function (sid, levelId) {
      var lv = LEVEL_MAP[levelId] || LEVELS[0];
      var all = this.loadAll();
      var key = (sid || "訪客學員") + "::" + lv.levelId;
      var legacyKey = (sid || "訪客學員") + "::" + lv.legacyNodeId;
      var raw = all[key] || all[legacyKey];
      if (!raw) {
        return {
          studentId: sid || "訪客學員",
          chapterId: lv.chapterId,
          levelId: lv.levelId,
          stageCode: "X-1",
          subStep: 1,
          stage1Completed: false,
          stage2Unlocked: false,
          stage2Completed: false,
          levelCompleted: false,
          stageCompletedMap: {},
          checkIndex: 0,
          practiceIndex: 0,
          remedialIndex: 0,
          hintLevelIndex: 0,
          remedialPassed: false,
          starCode: "UNRATED",
          lastFeedback: "",
          lastFeedbackType: "guide",
          logs: [],
          subConceptMastery: {}
        };
      }
      raw.studentId = sid || "訪客學員";
      raw.chapterId = lv.chapterId;
      raw.levelId = lv.levelId;
      raw.stageCode = raw.stageCode || "X-1";
      raw.subStep = raw.subStep || 1;
      raw.logs = Array.isArray(raw.logs) ? raw.logs : [];
      raw.stageCompletedMap = raw.stageCompletedMap && typeof raw.stageCompletedMap === "object" ? raw.stageCompletedMap : {};
      raw.subConceptMastery = raw.subConceptMastery && typeof raw.subConceptMastery === "object" ? raw.subConceptMastery : {};
      return raw;
    },
    saveAndSyncMastery: function (s) {
      var all = this.loadAll();
      var key = (s.studentId || "訪客學員") + "::" + s.levelId;
      s.stageCompletedMap = s.stageCompletedMap && typeof s.stageCompletedMap === "object" ? s.stageCompletedMap : {};
      s.stageCompletedMap[s.levelId + "::X-1"] = isStageFormallyCompleted(s, "X-1");
      s.stageCompletedMap[s.levelId + "::X-2"] = isStageFormallyCompleted(s, "X-2");
      s.stage1Completed = Boolean(s.stageCompletedMap[s.levelId + "::X-1"]);
      s.stage2Completed = Boolean(s.stageCompletedMap[s.levelId + "::X-2"]);
      s.levelCompleted = Boolean(s.stage1Completed && s.stage2Completed);
      all[key] = s;
      this.saveAll(all);

      var ev = evaluateLevelStarRating(s.logs, s.starCode, s.remedialPassed, s.levelId);
      s.starCode = ev.code;
      all[key] = s;
      this.saveAll(all);

      var mmap = this.loadMasteryMap();
      mmap[key] = {
        studentId: s.studentId,
        chapterId: s.chapterId,
        levelId: s.levelId,
        starCode: ev.code,
        starLabel: ev.studentLabel,
        missingReasons: ev.missingReasons,
        stage1Completed: Boolean(s.stage1Completed),
        stage2Unlocked: Boolean(s.stage2Unlocked),
        stage2Completed: Boolean(s.stage2Completed),
        levelCompleted: Boolean(s.levelCompleted),
        stageCompletedMap: s.stageCompletedMap,
        updatedAt: new Date().toISOString()
      };
      this.saveMasteryMap(mmap);
      return ev;
    },
    appendLog: function (sid, levelId, lg) {
      var s = this.getSession(sid, levelId);
      s.logs.push(lg);
      if (lg.subConcept) {
        s.subConceptMastery[lg.subConcept] = lg.isCorrect ? "已掌握" : "需加強（" + (lg.errorCode || "待釐清") + "）";
      }
      if (lg.isRemedial && lg.isCorrect) {
        s.remedialPassed = true;
      }
      this.saveAndSyncMastery(s);
      queueLearningAnswer(levelId, lg);
      return this.getSession(sid, levelId);
    }
  };

  // Level 彼此獨立；僅同一 Level 的 X-2 必須等待該 Level 的 X-1 完成。
  function getStrictStageAccess(sid, levelId, stageCode) {
    var lv = LEVEL_MAP[levelId] || LEVELS[0];
    var curSes = Repo.getSession(sid, lv.levelId);
    var completed = isStageFormallyCompleted(curSes, stageCode);

    if (stageCode !== "X-2") {
      return {
        allowed: true,
        completed: completed,
        status: completed ? "completed" : "available",
        statusText: completed
          ? "已完成此 Level 的觀念學習（可重新查看）。"
          : "目前可進行此 Level 的觀念學習。"
      };
    }

    var x1Done = isStageFormallyCompleted(curSes, "X-1");
    if (!x1Done) {
      return {
        allowed: false,
        completed: false,
        status: "locked",
        statusText: "請先完成此 Level 的觀念學習，才能解鎖練習應用。"
      };
    }

    return {
      allowed: true,
      completed: completed,
      status: completed ? "completed" : "available",
      statusText: completed
        ? "已完成此 Level 的練習應用（可重新查看）。"
        : "目前可進行此 Level 的練習應用。"
    };
  }

  function evaluateLevelStarRating(logs, prevCode, remedialPassed, levelId) {
    var lv = LEVEL_MAP[levelId] || LEVELS[0];
    var list = Array.isArray(logs) ? logs : [];
    var seen = {}, fTotal = 0, fOk = 0, highHint = 0, hasCheck = false, hasPractice = false;

    list.forEach(function (it) {
      var qid = it.questionId || "Q";
      var type = it.stageType || (it.isRemedial ? "remedial" : "practice");
      if (type === "guide") return;

      var conceptKey = type === "remedial" ? (it.errorCode || "") : (it.subConcept || "");
      var evidenceKey = type + "::" + qid + "::" + conceptKey;
      if (!seen[evidenceKey]) {
        seen[evidenceKey] = true;
        fTotal += 1;
        if (it.isCorrect) fOk += 1;
        if (it.hintLevel === "H3" || it.hintLevel === "H4") highHint += 1;
      }

      if (type === "check" && it.isCorrect) hasCheck = true;
      if ((type === "practice" || type === "remedial") && it.isCorrect) hasPractice = true;
    });

    var missing = [];
    if (!hasCheck) missing.push("尚未完成理解檢查作答");
    if (!hasPractice) missing.push("尚未完成互動練習或個人化加強作答");
    if (Object.keys(seen).length < EXP.minStarQ) missing.push("有效不同題目數不足（目前 " + Object.keys(seen).length + "/" + EXP.minStarQ + " 題）");

    if (missing.length > 0) {
      return {
        code: "UNRATED",
        studentLabel: "尚未評定",
        stars: 0,
        missingReasons: missing,
        detail: "缺少資料：" + missing.join("；")
      };
    }

    var ratio = fOk / fTotal;
    var nextCode = "ONE_STAR";
    if (ratio >= EXP.masteryRatio && highHint === 0 && remedialPassed) nextCode = "THREE_STARS";
    else if (ratio >= EXP.progressRatio || remedialPassed) nextCode = "TWO_STARS";

    var rank = { UNRATED: 0, ONE_STAR: 1, TWO_STARS: 2, THREE_STARS: 3 };
    var pCode = prevCode && rank[prevCode] !== undefined ? prevCode : "UNRATED";
    if (rank[pCode] > rank[nextCode] && ratio >= 0.5) nextCode = pCode;

    if (nextCode === "THREE_STARS") {
      return { code: "THREE_STARS", studentLabel: "★★★ 精熟", stars: 3, missingReasons: [], detail: lv.title + "：首次正確率 " + Math.round(ratio * 100) + "%、補救通過、低提示依賴。" };
    }
    if (nextCode === "TWO_STARS") {
      return { code: "TWO_STARS", studentLabel: "★★☆ 穩定進步", stars: 2, missingReasons: [], detail: lv.title + "：首次正確率 " + Math.round(ratio * 100) + "%、已累積多題證據。" };
    }
    return { code: "ONE_STAR", studentLabel: "★☆☆ 需要加強", stars: 1, missingReasons: [], detail: lv.title + "：首次正確率 " + Math.round(ratio * 100) + "%，建議依個人化加強逐步練習。" };
  }

  function getNextHint(s) {
    var order = ["H1", "H2", "H3", "H4"];
    var idx = typeof s.hintLevelIndex === "number" ? s.hintLevelIndex : 0;
    var safe = Math.max(0, Math.min(idx, order.length - 1));
    s.hintLevelIndex = Math.min(safe + 1, order.length - 1);
    return order[safe];
  }

  function getLevelQuestions(levelId) {
    var list = QUESTION_BANK.filter(function (q) { return q.active && q.levelId === levelId; });
    if (list && list.length > 0) return list;
    return [FALLBACK_PRACTICE_Q];
  }

  function getChapterCompletion(sid, chapterId) {
    var chLevels = LEVELS.filter(function (l) { return l.chapterId === chapterId; })
      .sort(function (a, b) { return a.levelNumber - b.levelNumber; });
    var completedCount = 0;
    var items = chLevels.map(function (lv) {
      var ses = Repo.getSession(sid, lv.levelId);
      var ev = evaluateLevelStarRating(ses.logs, ses.starCode, ses.remedialPassed, lv.levelId);
      var s1Acc = getStrictStageAccess(sid, lv.levelId, "X-1");
      var s2Acc = getStrictStageAccess(sid, lv.levelId, "X-2");
      var lvDone = Boolean(s1Acc.completed && s2Acc.completed);
      if (lvDone) completedCount += 1;
      return {
        levelId: lv.levelId,
        levelNumber: lv.levelNumber,
        title: lv.title,
        planetStyle: lv.planetStyle,
        s1: {
          code: lv.levelNumber + "-1",
          title: "觀念學習",
          unlocked: s1Acc.allowed,
          completed: s1Acc.completed,
          status: s1Acc.status,
          statusText: s1Acc.statusText
        },
        s2: {
          code: lv.levelNumber + "-2",
          title: "刷題練習",
          unlocked: s2Acc.allowed,
          completed: s2Acc.completed,
          status: s2Acc.status,
          statusText: s2Acc.statusText
        },
        stage1Completed: s1Acc.completed,
        stage2Unlocked: s2Acc.allowed,
        stage2Completed: s2Acc.completed,
        levelCompleted: lvDone,
        starCode: ev.code,
        starLabel: ev.studentLabel,
        missingReasons: ev.missingReasons
      };
    });
    return {
      chapterId: chapterId,
      completedCount: completedCount,
      totalCount: chLevels.length,
      allCompleted: chLevels.length > 0 && completedCount === chLevels.length,
      levels: items
    };
  }

  var uiState = {
    selectedChapterId: "CH-2",
    selectedLevelId: "CH2-L1"
  };

  function getSid() {
    var el = document.getElementById("stuInp");
    var d = el && el.value ? el.value.trim() : "";
    var s = (localStorage.getItem("edu_stu") || "").trim();
    return d || s || "訪客學員";
  }

  function renderLevelSummary(lv, s, starEv) {
    var ch = CHAPTERS[lv.chapterId];
    var chComp = getChapterCompletion(s.studentId, lv.chapterId);
    var subHtml = lv.subConcepts.map(function (sc) {
      var st = s.subConceptMastery[sc] || "尚未檢驗完成";
      return "<li><strong>" + esc(sc) + "</strong>：" + esc(st) + "</li>";
    }).join("");

    var chapterSummaryBox = "";
    if (chComp.allCompleted) {
      chapterSummaryBox =
        "<div class=\"te-sub-box\" style=\"border-color:#2DD4BF;\">" +
        "<strong>" + esc(ch.summaryTitle) + "（全章 Level 已完成，最終評量已解鎖）</strong>" +
        "<ul class=\"te-log-list\">" +
        ch.summaryKeyConcepts.map(function (kc) { return "<li>" + formatMathForStudent(kc) + "</li>"; }).join("") +
        "</ul>" +
        "</div>";
    }

    return (
      "<h4 class=\"te-card-title\">階段 6：學習總結（本 Level 總結）</h4>" +
      "<div class=\"te-sub-box\">" +
      "<strong>目前星球精熟度：</strong>" + esc(starEv.studentLabel) + "<br>" +
      "<strong>關卡狀態：</strong>觀念學習（" + (s.stage1Completed ? "已完成" : "未完成") + "）｜刷題練習（" + (s.stage2Completed ? "已完成" : "進行中") + "）｜本 Level（" + (s.levelCompleted ? "已完成" : "未完成") + "）<br>" +
      (starEv.missingReasons.length ? "<strong>待補齊評量依據：</strong>" + esc(starEv.missingReasons.join("；")) + "<br>" : "") +
      "<strong>正式定義：</strong>" + formatMathForStudent(lv.lesson.definition) + "<br>" +
      "<strong>公式推導與使用條件：</strong>" + formatMathForStudent(lv.lesson.derivation) + "｜" + formatMathForStudent(lv.lesson.conditions) + "<br>" +
      "<strong>常見錯誤：</strong>" + formatMathForStudent(lv.lesson.pitfalls) +
      "</div>" +
      "<div class=\"te-sub-box\"><strong>子觀念掌握狀況：</strong><ul class=\"te-log-list\">" + subHtml + "</ul></div>" +
      chapterSummaryBox +
      "<div class=\"te-actions\">" +
      "<button type=\"button\" class=\"te-btn\" id=\"te-complete-level\">確認完成學習總結並更新精熟度</button>" +
      "<button type=\"button\" class=\"te-btn secondary\" id=\"te-restart-level\">重新學習此 Level</button>" +
      "</div>"
    );
  }

  function renderStageContent(lv, s, starEv) {
    if (s.stageCode === "X-1") {
      if (s.subStep === 1) {
        return (
          "<h4 class=\"te-card-title\">Stage " + lv.levelNumber + "-1 觀念學習・1. 教材學習</h4>" +
          "<div class=\"te-sub-box\"><strong>學習動機：</strong>" + formatMathForStudent(lv.lesson.motivation) + "</div>" +
          "<div class=\"te-sub-box\"><strong>直觀理解：</strong>" + formatMathForStudent(lv.lesson.intuition) +
          (lv.lesson.diagramSvg ? "<div class=\"lesson-diagram-wrap\">" + lv.lesson.diagramSvg + "<div class=\"lesson-diagram-caption\">" + esc(lv.lesson.diagramCaption) + "</div></div>" : "") + "</div>" +
          "<div class=\"te-sub-box\"><strong>正式定義：</strong>" + formatMathForStudent(lv.lesson.definition) + "</div>" +
          "<div class=\"te-sub-box\"><strong>公式推導：</strong>" + formatMathForStudent(lv.lesson.derivation) + "</div>" +
          "<div class=\"te-sub-box\"><strong>使用條件：</strong>" + formatMathForStudent(lv.lesson.conditions) + "</div>" +
          "<div class=\"te-sub-box\"><strong>完整例題：</strong>" + formatMathForStudent(lv.lesson.example) + "</div>" +
          "<div class=\"te-sub-box\"><strong>常見錯誤：</strong>" + formatMathForStudent(lv.lesson.pitfalls) + "</div>" +
          "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-go-guide\">完成教材，進入 2. 引導問題（進入後鎖定返回教材）</button></div>"
        );
      }
      if (s.subStep === 2) {
        return (
          "<h4 class=\"te-card-title\">Stage " + lv.levelNumber + "-1 觀念學習・2. 引導問題（教材已鎖定）</h4>" +
          "<p class=\"te-text\">" + formatMathForStudent(lv.guide.prompt) + "</p>" +
          "<input type=\"text\" class=\"te-input\" id=\"te-ans\" placeholder=\"請用完整句子說明你的想法與原因\" />" +
          "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-submit\">送出引導說明</button></div>"
        );
      }
      var cList = lv.checkQuestions || [];
      var cIdx = Math.min(s.checkIndex || 0, Math.max(0, cList.length - 1));
      var cq = cList[cIdx];
      return (
        "<h4 class=\"te-card-title\">Stage " + lv.levelNumber + "-1 觀念學習・3. 理解檢查（第 " + (cIdx + 1) + "/" + cList.length + " 題）</h4>" +
        "<div class=\"te-sub-box\"><strong>對應子觀念：</strong>" + esc(cq.subConcept) + "</div>" +
        "<p class=\"te-text\">" + formatMathForStudent(cq.prompt) + "</p>" +
        "<input type=\"text\" class=\"te-input\" id=\"te-ans\" placeholder=\"請輸入作答\" />" +
        "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn\" id=\"te-submit\">送出理解檢查</button></div>"
      );
    }

    if (s.subStep === 4) {
      var qBank = getLevelQuestions(lv.levelId);
      var pIdx = Math.abs(Number(s.practiceIndex || 0)) % Math.max(1, qBank.length);
      var pq = qBank[pIdx] || FALLBACK_PRACTICE_Q;
      return (
        "<h4 class=\"te-card-title\">Stage " + lv.levelNumber + "-2 刷題練習・4. 互動練習（題庫第 " + (pIdx + 1) + "/" + qBank.length + " 題）</h4>" +
        "<div class=\"te-sub-box\"><strong>子觀念：</strong>" + esc(pq.subConcept) + "｜<strong>難度：</strong>" + esc(pq.difficulty) + "</div>" +
        "<p class=\"te-text\">" + formatMathForStudent(pq.prompt) + "</p>" +
        "<input type=\"text\" class=\"te-input\" id=\"te-ans\" placeholder=\"請輸入你的計算答案\" />" +
        "<div class=\"te-actions\">" +
        "<button type=\"button\" class=\"te-btn\" id=\"te-submit\">送出練習答案</button>" +
        "<button type=\"button\" class=\"te-btn secondary\" id=\"te-next-q\">換下一道題庫題目</button>" +
        "<button type=\"button\" class=\"te-btn secondary\" id=\"te-to-remedial\">前往 5. 個人化加強</button>" +
        "</div>"
      );
    }

    if (s.subStep === 5) {
      var lastErr = "E04";
      for (var i = s.logs.length - 1; i >= 0; i--) {
        if (!s.logs[i].isCorrect && s.logs[i].errorCode) { lastErr = s.logs[i].errorCode; break; }
      }
      var remList = REMEDIAL_BANK[lastErr] || REMEDIAL_BANK.E04;
      var rIdx = Math.abs(Number(s.remedialIndex || 0)) % remList.length;
      var rq = remList[rIdx];
      return (
        "<h4 class=\"te-card-title\">Stage " + lv.levelNumber + "-2 刷題練習・5. 個人化加強（針對錯誤類型：" + esc(ERR[lastErr] || lastErr) + "）</h4>" +
        "<div class=\"te-sub-box\">已依你的錯誤原因安排由淺入深的加強題（第 " + (rIdx + 1) + "/" + remList.length + " 題）。</div>" +
        "<p class=\"te-text\">" + formatMathForStudent(rq.prompt) + "</p>" +
        "<input type=\"text\" class=\"te-input\" id=\"te-ans\" placeholder=\"請輸入加強題答案\" />" +
        "<div class=\"te-actions\">" +
        "<button type=\"button\" class=\"te-btn\" id=\"te-submit\">送出加強題</button>" +
        "<button type=\"button\" class=\"te-btn secondary\" id=\"te-to-summary\">前往 6. 學習總結</button>" +
        "</div>"
      );
    }

    return renderLevelSummary(lv, s, starEv);
  }

  function processSubmit(sid, levelId, ans) {
    var lv = LEVEL_MAP[levelId] || LEVELS[0];
    var s = Repo.getSession(sid, lv.levelId);

    if (s.stageCode === "X-1" && s.subStep === 2) {
      var gRes = SemanticHook.analyzeExplanation({ nodeId: lv.legacyNodeId, stage: 2, answer: ans });
      var priorG = s.logs.filter(function (x) { return x.questionId === lv.guide.questionId; }).length;
      s = Repo.appendLog(sid, lv.levelId, {
        chapterId: lv.chapterId, levelId: lv.levelId, knowledgeNode: lv.legacyNodeId,
        questionId: lv.guide.questionId, stageType: "guide", subConcept: lv.subConcepts[0],
        dimension: lv.guide.dimension, studentAnswer: ans, isCorrect: gRes.ok,
        verdict: gRes.verdict, errorCode: gRes.errorCode,
        hintLevel: gRes.ok ? null : getNextHint(s), isFirstTry: priorG === 0,
        isRemedial: false, completedAt: new Date().toISOString()
      });
      if (gRes.ok) {
        s.hintLevelIndex = 0;
        s.subStep = 3;
        s.checkIndex = 0;
        s.lastFeedback = "引導說明清楚！現在進入「3. 理解檢查」，逐一檢驗本 Level 子觀念。";
        s.lastFeedbackType = "ok";
      } else {
        s.lastFeedback = (gRes.supplementPrompt || "請再補充說明你的理由。") + "【提示 " + (lv.hints.H1 || "") + "】";
        s.lastFeedbackType = "guide";
      }
      Repo.saveAndSyncMastery(s);
      return;
    }

    if (s.stageCode === "X-1" && s.subStep === 3) {
      var cList = lv.checkQuestions || [];
      var cIdx = Math.min(s.checkIndex || 0, Math.max(0, cList.length - 1));
      var cq = cList[cIdx];
      var cRes = cq.validate(ans);
      var priorC = s.logs.filter(function (x) { return x.questionId === cq.questionId; }).length;
      var hLvC = !cRes.ok ? getNextHint(s) : null;
      s = Repo.appendLog(sid, lv.levelId, {
        chapterId: lv.chapterId, levelId: lv.levelId, knowledgeNode: lv.legacyNodeId,
        questionId: cq.questionId, stageType: "check", subConcept: cq.subConcept,
        dimension: cq.dimension, studentAnswer: ans, isCorrect: cRes.ok,
        verdict: cRes.verdict, errorCode: cRes.errorCode,
        hintLevel: hLvC, isFirstTry: priorC === 0, isRemedial: false,
        completedAt: new Date().toISOString()
      });
      if (cRes.ok) {
        s.hintLevelIndex = 0;
        if (cIdx + 1 < cList.length) {
          s.checkIndex = cIdx + 1;
          s.lastFeedback = "本題通過！繼續下一道理解檢查題。";
          s.lastFeedbackType = "ok";
        } else {
          s.stage1Completed = true;
          s.stage2Unlocked = true;
          s.stageCompletedMap[lv.levelId + "::X-1"] = true;
          s.stageCode = "X-2";
          s.subStep = 4;
          s.practiceIndex = 0;
          s.lastFeedback = "Stage " + lv.levelNumber + "-1 觀念學習已完成！已解鎖 Stage " + lv.levelNumber + "-2 刷題練習（4. 互動練習）。";
          s.lastFeedbackType = "ok";
        }
      } else {
        s.lastFeedback = (cRes.supplementPrompt || "尚未完全正確，請再試一次。") + "\n【" + hLvC + "】" + (lv.hints[hLvC] || "");
        s.lastFeedbackType = "guide";
      }
      Repo.saveAndSyncMastery(s);
      return;
    }

    if (s.stageCode === "X-2" && s.subStep === 4) {
      var qBank = getLevelQuestions(lv.levelId);
      var pIdx = Math.abs(Number(s.practiceIndex || 0)) % Math.max(1, qBank.length);
      var pq = qBank[pIdx] || FALLBACK_PRACTICE_Q;
      var norm = String(ans || "").trim().replace(/^\+/, "");
      var okP = pq.acceptableAnswers.indexOf(norm) !== -1 || norm === pq.standardAnswer;
      var errP = okP ? null : (pq.commonErrors[0] || "E04");
      var hLvP = !okP ? getNextHint(s) : null;
      s = Repo.appendLog(sid, lv.levelId, {
        chapterId: lv.chapterId, levelId: lv.levelId, knowledgeNode: lv.legacyNodeId,
        questionId: pq.id, stageType: "practice", subConcept: pq.subConcept,
        dimension: "基礎運算", studentAnswer: ans, isCorrect: okP,
        verdict: okP ? "pass" : "incorrect", errorCode: errP,
        hintLevel: hLvP, isFirstTry: true, isRemedial: false,
        completedAt: new Date().toISOString()
      });
      if (okP) {
        s.hintLevelIndex = 0;
        s.stage2Completed = true;
        s.stageCompletedMap[lv.levelId + "::X-2"] = true;
        s.levelCompleted = Boolean(s.stage1Completed && s.stage2Completed);
        if (pIdx + 1 < qBank.length) {
          s.practiceIndex = pIdx + 1;
          s.lastFeedback = "答對了！Stage " + lv.levelNumber + "-2 刷題練習已完成，可繼續挑戰下一題或前往學習總結。";
          s.lastFeedbackType = "ok";
        } else {
          s.subStep = 5;
          s.remedialIndex = 0;
          s.lastFeedback = "已完成本輪互動練習題庫，接著進入「5. 個人化加強」進行針對性練習。";
          s.lastFeedbackType = "ok";
        }
      } else {
        s.lastFeedback = "這題尚未答對（" + ERR[errP] + "）。補充說明：" + pq.supplementNote + "\n【" + hLvP + "】" + (lv.hints[hLvP] || "");
        s.lastFeedbackType = "guide";
      }
      Repo.saveAndSyncMastery(s);
      return;
    }

    if (s.stageCode === "X-2" && s.subStep === 5) {
      var lastErr = "E04";
      for (var i = s.logs.length - 1; i >= 0; i--) {
        if (!s.logs[i].isCorrect && s.logs[i].errorCode) { lastErr = s.logs[i].errorCode; break; }
      }
      var remList = REMEDIAL_BANK[lastErr] || REMEDIAL_BANK.E04;
      var rIdx = Math.abs(Number(s.remedialIndex || 0)) % remList.length;
      var rq = remList[rIdx];
      var normR = String(ans || "").trim().replace(/^\+/, "");
      var okR = normR === rq.answer;
      s = Repo.appendLog(sid, lv.levelId, {
        chapterId: lv.chapterId, levelId: lv.levelId, knowledgeNode: lv.legacyNodeId,
        questionId: lv.levelId + "-REM-" + rIdx, stageType: "remedial", subConcept: lv.subConcepts[0],
        dimension: "應用能力", studentAnswer: ans, isCorrect: okR,
        verdict: okR ? "pass" : "incorrect", errorCode: lastErr,
        hintLevel: okR ? null : getNextHint(s), isFirstTry: true, isRemedial: true,
        completedAt: new Date().toISOString()
      });
      if (okR) {
        s.remedialPassed = true;
        s.subStep = 6;
        s.stage2Completed = true;
        s.stageCompletedMap[lv.levelId + "::X-2"] = true;
        s.levelCompleted = Boolean(s.stage1Completed && s.stage2Completed);
        s.lastFeedback = "個人化加強完成！已進入「6. 學習總結」並更新本 Level 星級精熟度。";
        s.lastFeedbackType = "ok";
      } else {
        s.remedialIndex = rIdx + 1;
        s.lastFeedback = "再試一次！先對照題目條件與運算步驟，或按「前往 6. 學習總結」查看總結。";
        s.lastFeedbackType = "guide";
      }
      Repo.saveAndSyncMastery(s);
    }
  }

  function renderEngine(container, preferredNodeOrLevelId) {
    if (!container) return;
    if (preferredNodeOrLevelId) {
      if (LEVEL_MAP[preferredNodeOrLevelId]) {
        uiState.selectedLevelId = preferredNodeOrLevelId;
        uiState.selectedChapterId = LEVEL_MAP[preferredNodeOrLevelId].chapterId;
      } else {
        var found = LEVELS.find(function (l) { return l.legacyNodeId === preferredNodeOrLevelId; });
        if (found) {
          uiState.selectedLevelId = found.levelId;
          uiState.selectedChapterId = found.chapterId;
        }
      }
    }

    var sid = getSid();
    var lv = LEVEL_MAP[uiState.selectedLevelId] || LEVELS[0];
    var ch = CHAPTERS[lv.chapterId] || CHAPTERS["CH-1"];
    var s = Repo.getSession(sid, lv.levelId);

    var curStageAccess = getStrictStageAccess(sid, lv.levelId, s.stageCode);
    if (!curStageAccess.allowed) {
      s.stageCode = "X-1";
      if (s.subStep > 3) s.subStep = 1;
      s.lastFeedback = curStageAccess.statusText;
      s.lastFeedbackType = "guide";
    }
    if (s.stageCode === "X-2") {
      s.stage2Unlocked = getStrictStageAccess(sid, lv.levelId, "X-2").allowed;
      if (!s.subStep || s.subStep < 4) s.subStep = 4;
    }

    var starEv = Repo.saveAndSyncMastery(s);
    var chComp = getChapterCompletion(sid, ch.chapterId);

    var chTabs = Object.keys(CHAPTERS).map(function (cid) {
      var cObj = CHAPTERS[cid];
      return "<button type=\"button\" class=\"te-topic-btn" + (cid === ch.chapterId ? " active" : "") + "\" data-ch-id=\"" + esc(cid) + "\">Chapter " + cObj.chapterNumber + "：" + esc(cObj.title) + "</button>";
    }).join("");

    var lvTabs = LEVELS.filter(function (l) { return l.chapterId === ch.chapterId; }).map(function (l) {
      var lSes = Repo.getSession(sid, l.levelId);
      var lEv = evaluateLevelStarRating(lSes.logs, lSes.starCode, lSes.remedialPassed, l.levelId);
      return "<button type=\"button\" class=\"te-topic-btn" + (l.levelId === lv.levelId ? " active" : "") + "\" data-lv-id=\"" + esc(l.levelId) + "\">Level " + l.levelNumber + "：" + esc(l.title) + "（" + esc(lEv.studentLabel) + "）</button>";
    }).join("");

    var s2Access = getStrictStageAccess(sid, lv.levelId, "X-2");
    var stageSwitchHtml =
      "<div class=\"te-actions\" style=\"margin-bottom:12px;\">" +
      "<button type=\"button\" class=\"te-btn" + (s.stageCode === "X-1" ? "" : " secondary") + "\" id=\"te-sw-s1\">Stage " + lv.levelNumber + "-1 觀念學習（1.教材／2.引導／3.理解檢查）</button>" +
      "<button type=\"button\" class=\"te-btn" + (s.stageCode === "X-2" ? "" : " secondary") + "\" id=\"te-sw-s2\" " + (!s2Access.allowed ? "disabled style=\"opacity:0.5;cursor:not-allowed;\"" : "") + ">Stage " + lv.levelNumber + "-2 刷題練習（4.互動練習／5.個人化加強／6.學習總結）" + (!s2Access.allowed ? "・" + esc(s2Access.statusText) : "") + "</button>" +
      "</div>";

    var fbHtml = s.lastFeedback ? "<div class=\"te-feedback " + (s.lastFeedbackType === "ok" ? "ok" : "guide") + "\">" + formatMathForStudent(s.lastFeedback) + "</div>" : "";

    container.innerHTML =
      "<section class=\"te-root\">" +
      "<div class=\"te-topic-tabs\">" + chTabs + "</div>" +
      "<div class=\"te-topic-tabs\">" + lvTabs + "</div>" +
      "<div class=\"te-header-bar\">" +
      "<div><strong>Chapter " + ch.chapterNumber + "（" + esc(ch.title) + "）→ Level " + lv.levelNumber + "（" + esc(lv.title) + "）</strong> <span style=\"font-size:13px;color:#CBD5E1;\">學員：" + esc(sid) + "｜" + esc(starEv.studentLabel) + "</span></div>" +
      "<span class=\"te-mode-pill\">本章進度 " + chComp.completedCount + "/" + chComp.totalCount + " Level｜最終評量：" + (chComp.allCompleted ? "已解鎖" : "尚未解鎖") + "</span>" +
      "</div>" +
      stageSwitchHtml +
      "<div class=\"te-card\">" + renderStageContent(lv, s, starEv) + fbHtml + "</div>" +
      "</section>";

    container.querySelectorAll("[data-ch-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cid = btn.getAttribute("data-ch-id");
        uiState.selectedChapterId = cid;
        var firstLv = LEVELS.find(function (l) { return l.chapterId === cid; });
        if (firstLv) uiState.selectedLevelId = firstLv.levelId;
        renderEngine(container, uiState.selectedLevelId);
      });
    });

    container.querySelectorAll("[data-lv-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        uiState.selectedLevelId = btn.getAttribute("data-lv-id");
        renderEngine(container, uiState.selectedLevelId);
      });
    });

    var sw1 = document.getElementById("te-sw-s1");
    if (sw1) sw1.addEventListener("click", function () {
      var cur = Repo.getSession(getSid(), lv.levelId);
      cur.stageCode = "X-1";
      if (cur.subStep > 3) cur.subStep = 1;
      Repo.saveAndSyncMastery(cur);
      renderEngine(container, lv.levelId);
    });

    var sw2 = document.getElementById("te-sw-s2");
    if (sw2) sw2.addEventListener("click", function () {
      var acc = getStrictStageAccess(getSid(), lv.levelId, "X-2");
      var cur = Repo.getSession(getSid(), lv.levelId);
      if (!acc.allowed) {
        cur.lastFeedback = acc.statusText;
        cur.lastFeedbackType = "guide";
        Repo.saveAndSyncMastery(cur);
        renderEngine(container, lv.levelId);
        return;
      }
      cur.stageCode = "X-2";
      if (!cur.subStep || cur.subStep < 4) cur.subStep = 4;
      Repo.saveAndSyncMastery(cur);
      renderEngine(container, lv.levelId);
    });

    var goG = document.getElementById("te-go-guide");
    if (goG) goG.addEventListener("click", function () {
      var cur = Repo.getSession(getSid(), lv.levelId);
      cur.stageCode = "X-1";
      cur.subStep = 2;
      cur.lastFeedback = "已進入「2. 引導問題」。教材已鎖定，請說明你的推理與原因。";
      cur.lastFeedbackType = "ok";
      Repo.saveAndSyncMastery(cur);
      renderEngine(container, lv.levelId);
    });

    var subBtn = document.getElementById("te-submit");
    var ansInp = document.getElementById("te-ans");
    if (subBtn && ansInp) subBtn.addEventListener("click", function () {
      var val = ansInp.value.trim();
      if (!val) {
        var cs = Repo.getSession(getSid(), lv.levelId);
        cs.lastFeedback = "【需要補充說明】請先輸入你的想法或答案再送出。";
        cs.lastFeedbackType = "guide";
        Repo.saveAndSyncMastery(cs);
        renderEngine(container, lv.levelId);
        return;
      }
      processSubmit(getSid(), lv.levelId, val);
      renderEngine(container, lv.levelId);
    });

    var nextQ = document.getElementById("te-next-q");
    if (nextQ) nextQ.addEventListener("click", function () {
      var cur = Repo.getSession(getSid(), lv.levelId);
      var bank = getLevelQuestions(lv.levelId);
      cur.practiceIndex = (Math.abs(Number(cur.practiceIndex || 0)) + 1) % Math.max(1, bank.length);
      Repo.saveAndSyncMastery(cur);
      renderEngine(container, lv.levelId);
    });

    var toRem = document.getElementById("te-to-remedial");
    if (toRem) toRem.addEventListener("click", function () {
      var cur = Repo.getSession(getSid(), lv.levelId);
      cur.stageCode = "X-2";
      cur.subStep = 5;
      Repo.saveAndSyncMastery(cur);
      renderEngine(container, lv.levelId);
    });

    var toSum = document.getElementById("te-to-summary");
    if (toSum) toSum.addEventListener("click", function () {
      var cur = Repo.getSession(getSid(), lv.levelId);
      cur.stageCode = "X-2";
      cur.subStep = 6;
      Repo.saveAndSyncMastery(cur);
      renderEngine(container, lv.levelId);
    });

    var compLv = document.getElementById("te-complete-level");
    if (compLv) compLv.addEventListener("click", async function () {
      var cur = Repo.getSession(getSid(), lv.levelId);
      var ev = Repo.saveAndSyncMastery(cur);
      if (!cur.levelCompleted) {
        cur.lastFeedback = "目前尚未完成本 Level 正式條件（" + ev.detail + "），請完成必要學習活動後再確認。";
        cur.lastFeedbackType = "guide";
        Repo.saveAndSyncMastery(cur);
        renderEngine(container, lv.levelId);
        return;
      }

      cur.lastFeedback = "正在同步學習紀錄與精熟程度…";
      cur.lastFeedbackType = "guide";
      Repo.saveAndSyncMastery(cur);
      renderEngine(container, lv.levelId);

      var syncModule = window.LearningStatsAndResourcesModule;
      if (!syncModule || typeof syncModule.commitLearningSummary !== "function") {
        cur.lastFeedback = "本機學習狀態已更新，但伺服器同步模組尚未載入；請重新整理後再試。";
        cur.lastFeedbackType = "guide";
        Repo.saveAndSyncMastery(cur);
        renderEngine(container, lv.levelId);
        return;
      }

      try {
        var result = await syncModule.commitLearningSummary({
          levelId: lv.levelId,
          chapterId: lv.chapterId,
          stageId: "X-2",
          markStageCompleted: true
        });
        if (result && result.ok) {
          cur.lastFeedback = "已成功儲存「" + lv.title + "」學習紀錄與精熟程度：" + ev.studentLabel + "。" +
            (result.statsWarning ? " " + result.statsWarning : "");
          cur.lastFeedbackType = "ok";
          Repo.saveAndSyncMastery(cur);
          window.dispatchEvent(new CustomEvent("star-learning:summary-committed", {
            detail: { levelId: lv.levelId, chapterId: lv.chapterId, stats: result.stats }
          }));
        } else {
          cur.lastFeedback = "本機學習狀態已更新，但伺服器同步失敗：" + ((result && result.message) || "未知錯誤") + "。請稍後重試。";
          cur.lastFeedbackType = "guide";
          Repo.saveAndSyncMastery(cur);
        }
      } catch (syncError) {
        cur.lastFeedback = "本機學習狀態已更新，但伺服器同步時發生連線錯誤：" + (syncError && syncError.message ? syncError.message : "請稍後重試") + "。";
        cur.lastFeedbackType = "guide";
        Repo.saveAndSyncMastery(cur);
      }
      renderEngine(container, lv.levelId);
    });

    var rstLv = document.getElementById("te-restart-level");
    if (rstLv) rstLv.addEventListener("click", function () {
      var fresh = {
        studentId: getSid(), chapterId: lv.chapterId, levelId: lv.levelId,
        stageCode: "X-1", subStep: 1, stage1Completed: false, stage2Unlocked: false,
        stage2Completed: false, levelCompleted: false, stageCompletedMap: {},
        checkIndex: 0, practiceIndex: 0, remedialIndex: 0, hintLevelIndex: 0,
        remedialPassed: false, starCode: "UNRATED",
        lastFeedback: "已重新開始此 Level（Stage " + lv.levelNumber + "-1 教材學習）。",
        lastFeedbackType: "ok", logs: [], subConceptMastery: {}
      };
      Repo.saveAndSyncMastery(fresh);
      renderEngine(container, lv.levelId);
    });
  }

  window.TeachingEngineModule = {
    render: renderEngine,
    repository: Repo,
    chapters: CHAPTERS,
    levels: LEVELS,
    questionBank: QUESTION_BANK,
    remedialBank: REMEDIAL_BANK,
    evaluateLevelStarRating: evaluateLevelStarRating,
    getChapterCompletion: getChapterCompletion,
    getStrictStageAccess: getStrictStageAccess,
    isStageFormallyCompleted: isStageFormallyCompleted,
    flushLearningSync: flushLearningSync,
    formatMathForStudent: formatMathForStudent,
    getStudentTitle: function (id) {
      var lv = LEVELS.find(function (x) { return x.levelId === id || x.legacyNodeId === id; });
      return lv ? lv.title : "學習關卡";
    },
    getTeacherLabel: function (id) {
      var lv = LEVELS.find(function (x) { return x.levelId === id || x.legacyNodeId === id; });
      return lv ? (lv.title + "（" + lv.levelId + " / " + lv.legacyNodeId + "）") : String(id || "");
    }
  };
})();

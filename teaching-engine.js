/* 第二階段：學生端教學引擎 - 第一輪品質修正（獨立模組） */
(function () {
  "use strict";

  // 0. 可調整實驗參數（非教育研究驗證標準，僅供測試調整）
  var EXPERIMENTAL_PARAMS = {
    minValidAttemptsPerDimension: 2, // 各維度有效作答數低於此門檻時顯示「尚需更多練習」
    masteryMinFirstTryRatio: 0.75,   // 達「精熟」之首次作答正確率實驗門檻
    progressMinRatio: 0.40           // 達「穩定進步」之作答正確率實驗門檻
  };

  // 1. 內部錯誤分類定義（代碼僅供系統使用，不直接顯示給學生）
  var ERROR_TAXONOMY = {
    E01: "定義理解錯誤",
    E02: "性質使用錯誤",
    E03: "忽略適用條件",
    E04: "運算錯誤",
    E05: "推論錯誤",
    E06: "題意理解或建模錯誤",
    E07: "抄寫或計算疏失"
  };

  // 2. 具體錯誤補救策略（依具體錯誤成因提供不同引導，不與錯誤代碼綁死單一罐頭字）
  function resolveSpecificRemediation(errorCode, rawAnswer, node, stage) {
    var ans = String(rawAnswer || "").trim();

    if (errorCode === "E01") {
      if (node.id === "M1-01" && (ans.indexOf("6") !== -1 || ans.indexOf("15") !== -1 || ans.indexOf("× 3") !== -1 || ans.indexOf("×3") !== -1)) {
        return {
          causeKey: "exponent_as_product",
          encouragement: "你把次方聯想到乘法，方向很接近，不過「a 的 n 次方」是指 n 個 a 連乘，不是乘以 n。",
          coaching: "把底數寫出來連乘看看：如果是 2 的 3 次方，是 2 × 2 × 2，而不是 2 × 3。"
        };
      }
      if (node.id === "M1-02" && ans.indexOf("0") !== -1) {
        return {
          causeKey: "zero_exponent_equals_zero",
          encouragement: "看到 0 次方想到 0 是很直覺的想法，但在指數規定裡，非零數的 0 次方結果是 1，不是 0。",
          coaching: "試著用除法規律想一想：同一個非零數自己除自己（例如 5^2 ÷ 5^2）結果是多少？"
        };
      }
      return {
        causeKey: "general_definition",
        encouragement: "我們先回到這個觀念的核心定義，看看題目要表達的是哪一種關係。",
        coaching: "先用自己的話說出底數與次方各自代表什麼，再判斷算式。"
      };
    }

    if (errorCode === "E02") {
      if (ans.indexOf("-24") !== -1 || ans.indexOf("-9") !== -1 || ans.indexOf("9") !== -1) {
        return {
          causeKey: "bracket_vs_sign",
          encouragement: "這題的關鍵在於「括號有沒有把負號包進去」以及「奇偶數次方對正負號的影響」。",
          coaching: "先分開看每一項：有括號時次方作用在整個括號內；沒括號時先算次方再看前面的負號。"
        };
      }
      return {
        causeKey: "property_misuse",
        encouragement: "性質運用上有一點小偏差，我們先確認每一步適用的運算規則。",
        coaching: "把算式拆成較小的步驟，逐項檢查是否符合指數規則。"
      };
    }

    if (errorCode === "E03") {
      return {
        causeKey: "missing_condition",
        encouragement: "差一點就抓到了！這類題目除了算式外，還要特別留意「底數不能為 0」的限制條件。",
        coaching: "把次方底數的整串式子拿出來，想想它「不能等於 0」會推導出什麼條件。"
      };
    }

    if (errorCode === "E04") {
      if (ans.indexOf("-") !== -1) {
        return {
          causeKey: "negative_multiplication",
          encouragement: "計算時在正負號相乘或相加這一步遇到小阻礙，我們把正負號分開處理會更清楚。",
          coaching: "先決定每一項的正負號（奇數個負號為負、偶數個負號為正），再算數字大小。"
        };
      }
      return {
        causeKey: "arithmetic_step",
        encouragement: "觀念方向已經有了，只是中間數字運算還需要再確認一下。",
        coaching: "先把每個次方項算出數值寫在旁邊，最後再做加減。"
      };
    }

    if (errorCode === "E05") {
      return {
        causeKey: "reasoning_incomplete",
        encouragement: "你的作答有提到部分線索，但推論的因果關聯還不夠完整。",
        coaching: "試著用「因為……所以……」把你的觀察與結論串起來。"
      };
    }

    if (errorCode === "E06") {
      return {
        causeKey: "modeling_or_empty",
        encouragement: "題目條件與你的作答之間還需要多一點對齊，我們先看清楚題目問的是什麼。",
        coaching: "先把題目給的已知數值與要算的目標圈出來，再決定要用哪個觀念。"
      };
    }

    // E07
    return {
      causeKey: "careless_slip",
      encouragement: "可能是看題或抄寫時不小心看漏了符號或數字，這很常見，放慢速度再看一次。",
      coaching: "對照題目上的數字與正負號，逐字檢查一次再送出。"
    };
  }

  // 3. 文字解釋判斷器（不只看單一關鍵字，區分概念正確 / 部分正確 / 無法判斷，並預留 AI 語意分析介面）
  var SemanticAnalyzerHook = {
    // 未來可掛載外部 AI 語意分析函式：(payload) => ({ verdict: "pass"|"partial"|"unclear", reason: "" })
    customAnalyzer: null,
    analyzeExplanation: function (payload) {
      if (typeof this.customAnalyzer === "function") {
        return this.customAnalyzer(payload);
      }

      var text = String((payload && payload.answer) || "").trim();
      var lower = text.toLowerCase();

      // 若只輸入極短單詞或單一字（「正」、「負」、「1」等），判定為無法可靠判斷，要求補充說明
      if (text.length <= 1 || /^[\+\-]?\d+$/.test(text)) {
        return {
          verdict: "unclear",
          errorCode: "E05",
          supplementPrompt:
            "只寫單一字詞或數字還看不出你的想法喔！請用完整一點的句子說明「為什麼會這樣」或「你是怎麼推想的」。"
        };
      }

      if (payload.nodeId === "M1-01") {
        var mentionsSign = lower.indexOf("負") !== -1 || lower.indexOf("正") !== -1 || lower.indexOf("正負") !== -1;
        var mentionsParityOrBracket =
          lower.indexOf("奇") !== -1 ||
          lower.indexOf("偶") !== -1 ||
          lower.indexOf("括號") !== -1 ||
          lower.indexOf("連乘") !== -1 ||
          lower.indexOf("次") !== -1;

        if (mentionsSign && mentionsParityOrBracket) {
          return { verdict: "pass", errorCode: null };
        }
        if (mentionsSign || mentionsParityOrBracket) {
          return {
            verdict: "partial",
            errorCode: "E05",
            supplementPrompt:
              "你已經提到一部分概念了！請再補充說明「奇數次方與偶數次方」或「括號範圍」如何影響正負號。"
          };
        }
        return {
          verdict: "unclear",
          errorCode: "E01",
          supplementPrompt:
            "這段說明還沒有連結到指數的連乘或正負號規則，請試著說明次方次數與結果正負的關聯。"
        };
      }

      // M1-02 零指數除法規律說明
      var mentionsDivisionOrSame =
        lower.indexOf("除") !== -1 ||
        lower.indexOf("相減") !== -1 ||
        lower.indexOf("自己") !== -1 ||
        lower.indexOf("相同") !== -1;
      var mentionsOneOrNonZero =
        lower.indexOf("1") !== -1 ||
        lower.indexOf("一") !== -1 ||
        lower.indexOf("不為 0") !== -1 ||
        lower.indexOf("不為0") !== -1 ||
        lower.indexOf("非零") !== -1 ||
        lower.indexOf("≠") !== -1;

      if (mentionsDivisionOrSame && mentionsOneOrNonZero) {
        return { verdict: "pass", errorCode: null };
      }
      if (mentionsDivisionOrSame || mentionsOneOrNonZero) {
        return {
          verdict: "partial",
          errorCode: "E05",
          supplementPrompt:
            "你抓到了一半的線索！請再把「相同非零數相除為 1」或「指數相減得到 0 次方」的關聯寫清楚。"
        };
      }
      return {
        verdict: "unclear",
        errorCode: "E01",
        supplementPrompt:
          "目前的說明還看不出與除法規律或非零底數的關聯，請試著用除法算式或自己的話再補充說明。"
      };
    }
  };

  // 4. 既有 M1-01、M1-02 教材（完整保留原始教材內容）與修正後教學／補救設定
  var KNOWLEDGE_NODES = {
    "M1-01": {
      id: "M1-01",
      code: "M1-01",
      title: "M1-01 正整數指數",
      stage1Material:
        "【教材重點｜M1-01 正整數指數】\n" +
        "1. 定義：設 a 為任意實數，n 為正整數，a^n 表示 n 個 a 連續相乘（a × a × ... × a，共 n 個）。\n" +
        "2. 正例：2^3 = 2 × 2 × 2 = 8；(-3)^2 = (-3) × (-3) = 9。\n" +
        "3. 反例與提醒：2^3 不是 2 × 3 = 6；-3^2 代表 -(3 × 3) = -9，與 (-3)^2 不同。",
      stage2Guide: {
        questionId: "M1-01-S2-GUIDE",
        dimension: "推理能力",
        prompt:
          "想一想：當底數是負數時，次方次數是奇數或偶數，結果的正負號有什麼不同？請用自己的話說明為什麼 (-2)^3 與 (-2)^4 的正負號不同。",
        expectedAnswerDesc: "說明奇數次方與偶數次方（或括號連乘）對正負號的影響",
        validate: function (raw, nodeId) {
          return SemanticAnalyzerHook.analyzeExplanation({
            nodeId: nodeId,
            stage: 2,
            answer: raw
          });
        }
      },
      stage3Check: {
        questionId: "M1-01-S3-CHECK",
        dimension: "概念理解",
        prompt:
          "【理解檢查】下列哪一個算式的值與 -5^2 相等？（請輸入 A、B 或 C）\n" +
          "A. (-5)^2\n" +
          "B. -(5 × 5)\n" +
          "C. (-5) × 2",
        expectedAnswer: "B",
        validate: function (raw) {
          var u = String(raw || "").trim().toUpperCase();
          if (!u) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請先輸入選項 A、B 或 C。" };
          if (u === "B") return { verdict: "pass", ok: true, errorCode: null };
          if (u === "A") return { verdict: "fail", ok: false, errorCode: "E02" };
          if (u === "C") return { verdict: "fail", ok: false, errorCode: "E01" };
          return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入 A、B 或 C 其中一個選項，並可順便想想看次方作用在誰身上。" };
        }
      },
      stage4Practice: {
        questionId: "M1-01-S4-PRACTICE",
        dimension: "基礎運算",
        prompt: "【互動練習】請計算 2^3 + (-3)^2 的值是多少？",
        expectedAnswer: "17",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請先輸入計算結果。" };
          if (!/^[\+\-]?\d+$/.test(t)) {
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "這題需要算出最後的整數數值，請輸入數字結果。" };
          }
          if (t === "17") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "14" || t === "0" || t === "-1") return { verdict: "fail", ok: false, errorCode: "E02" };
          if (t === "15" || t === "12") return { verdict: "fail", ok: false, errorCode: "E07" };
          return { verdict: "fail", ok: false, errorCode: "E04" };
        }
      },
      // 修正後補救題：合理情境（冷藏庫溫度變化與正方形地墊面積），不出現負數邊長
      stage5Remedial: {
        questionId: "M1-01-S5-REMEDIAL",
        dimension: "應用能力",
        contextNote: "情境轉換：實驗室溫度調整與正方形地墊面積（皆為合理數值）",
        prompt:
          "【個人化補救題】某實驗室連續 2 小時每小時降溫 (-3) 度的算式概念為 (-3)^2，另有一塊邊長為 2 公尺的正方形地墊，面積為 2^3 平方公尺（代表 2 連乘 3 次）。請問 (-3)^2 + 2^3 的總值是多少？",
        expectedAnswer: "17",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請輸入計算結果。" };
          if (!/^[\+\-]?\d+$/.test(t)) {
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入數值結果。" };
          }
          if (t === "17") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "1" || t === "-1") return { verdict: "fail", ok: false, errorCode: "E02" };
          return { verdict: "fail", ok: false, errorCode: "E04" };
        }
      },
      hints: {
        H1: "先回想次方代表「連續相乘的次數」，並留意括號有沒有把負號包進去。",
        H2: "你可以先拆成個別項目的正負號與連乘算式，再把結果合起來看。",
        H3: "先算 2^3 = 2 × 2 × 2 = 8，再算 (-3)^2 = (-3) × (-3) = 9，最後將兩數相加。",
        H4: "完整解析：2^3 = 8，(-3)^2 = 9，8 + 9 = 17。關鍵在於看清楚次方作用在誰身上。"
      }
    },

    "M1-02": {
      id: "M1-02",
      code: "M1-02",
      title: "M1-02 零指數",
      stage1Material:
        "【教材重點｜M1-02 零指數】\n" +
        "1. 定義：當底數 a ≠ 0 時，規定 a^0 = 1。\n" +
        "2. 必要條件：若底數為 0，0^0 在數學上沒有意義，因此底數不能為 0。\n" +
        "3. 正例與反例：7^0 = 1、(-6)^0 = 1；但 7^0 不等於 0，且 (x - 3)^0 = 1 時 x 必須 ≠ 3。",
      stage2Guide: {
        questionId: "M1-02-S2-GUIDE",
        dimension: "推理能力",
        prompt:
          "想一想：如果同底數相除時指數相減，例如 5^2 ÷ 5^2 會得到 5^0；從除法規律來看，為什麼非零數的 0 次方會規定為 1，而不是 0？請用自己的話說明。",
        expectedAnswerDesc: "用相同非零數相除等於 1 或指數相減規則說明為何 a^0 = 1",
        validate: function (raw, nodeId) {
          return SemanticAnalyzerHook.analyzeExplanation({
            nodeId: nodeId,
            stage: 2,
            answer: raw
          });
        }
      },
      stage3Check: {
        questionId: "M1-02-S3-CHECK",
        dimension: "概念理解",
        prompt:
          "【理解檢查】若 (x - 3)^0 = 1 成立，x 必須滿足什麼條件？（請輸入 A、B 或 C）\n" +
          "A. x 可以是任意實數\n" +
          "B. x ≠ 3\n" +
          "C. x > 3",
        expectedAnswer: "B",
        validate: function (raw) {
          var u = String(raw || "").trim().toUpperCase();
          if (!u) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請先輸入選項 A、B 或 C。" };
          if (u === "B") return { verdict: "pass", ok: true, errorCode: null };
          if (u === "A") return { verdict: "fail", ok: false, errorCode: "E03" };
          if (u === "C") return { verdict: "fail", ok: false, errorCode: "E07" };
          return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入 A、B 或 C 其中一個選項。" };
        }
      },
      stage4Practice: {
        questionId: "M1-02-S4-PRACTICE",
        dimension: "基礎運算",
        prompt: "【互動練習】請計算 (-6)^0 + 2^3 - 5^0 的值是多少？",
        expectedAnswer: "8",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請先輸入計算結果。" };
          if (!/^[\+\-]?\d+$/.test(t)) {
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入數值結果。" };
          }
          if (t === "8") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "7" || t === "2" || t === "0") return { verdict: "fail", ok: false, errorCode: "E01" };
          if (t === "9") return { verdict: "fail", ok: false, errorCode: "E07" };
          return { verdict: "fail", ok: false, errorCode: "E04" };
        }
      },
      // 修正後補救題：合理情境（社團活動分組與點數加成），清楚檢驗零指數觀念
      stage5Remedial: {
        questionId: "M1-02-S5-REMEDIAL",
        dimension: "應用能力",
        contextNote: "情境轉換：班級讀書會分組與積分計算（皆為正整數情境）",
        prompt:
          "【個人化補救題】班級讀書會每組有 2^2 位成員，另有 1 個剛成立的觀察小組（以 4^0 代表 1 組）與 1 個特別嘉獎組（以 (-3)^0 代表 1 組）。請問這三個部分合起來共有幾組（4^0 + (-3)^0 + 2^2）？",
        expectedAnswer: "6",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請輸入組數計算結果。" };
          if (!/^[\+\-]?\d+$/.test(t)) {
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入數值結果。" };
          }
          if (t === "6") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "4" || t === "5") return { verdict: "fail", ok: false, errorCode: "E01" };
          return { verdict: "fail", ok: false, errorCode: "E04" };
        }
      },
      hints: {
        H1: "先提醒自己：底數不為 0 時，零次方的結果是 1，而不是 0；同時底數本身不能為 0。",
        H2: "把算式拆成每一項分別算出來，再依加減順序合併，別急著心算整串。",
        H3: "先算 (-6)^0 = 1，2^3 = 8，5^0 = 1，接著依序計算 1 + 8 - 1。",
        H4: "完整解析：(-6)^0 = 1，2^3 = 8，5^0 = 1，1 + 8 - 1 = 8。非零數的零次方皆為 1。"
      }
    }
  };

  // 5. 學習紀錄儲存層（與教學邏輯分離）
  var STORAGE_KEY = "ai_edu_phase2_records_v1";

  var TeachingRecordRepository = {
    loadAll: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        var parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (e) {
        return {};
      }
    },
    saveAll: function (allMap) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allMap));
      } catch (e) {
        // 忽略本機儲存例外
      }
    },
    getNodeSession: function (studentId, nodeId) {
      var all = this.loadAll();
      var key = (studentId || "guest") + "::" + nodeId;
      return (
        all[key] || {
          studentId: studentId || "guest",
          nodeId: nodeId,
          currentStage: 1,
          unlockedStage: 1,
          hintLevelIndex: 0,
          remedialPassed: false,
          lastFeedback: "",
          lastFeedbackType: "guide",
          logs: []
        }
      );
    },
    saveNodeSession: function (session) {
      var all = this.loadAll();
      var key = (session.studentId || "guest") + "::" + session.nodeId;
      all[key] = session;
      this.saveAll(all);
    },
    appendAnswerLog: function (studentId, nodeId, logEntry) {
      var session = this.getNodeSession(studentId, nodeId);
      session.logs.push(logEntry);
      if (logEntry.isRemedial && logEntry.isCorrect) {
        session.remedialPassed = true;
      }
      this.saveNodeSession(session);
      return session;
    }
  };

  // 6. 五維度獨立精熟度計算器（區分首次作答與重複練習、設最低有效作答數、不混算總正確率）
  function evaluateFiveDimensions(logs, remedialPassed) {
    var list = Array.isArray(logs) ? logs : [];
    var minReq = EXPERIMENTAL_PARAMS.minValidAttemptsPerDimension;

    var dimsOrder = ["概念理解", "基礎運算", "推理能力", "應用能力", "獨立完成程度"];
    var perDimLogs = {
      概念理解: [],
      基礎運算: [],
      推理能力: [],
      應用能力: []
    };

    var firstTryCount = 0;
    var firstTryCorrectCount = 0;
    var repeatAttemptCount = 0;
    var repeatCorrectCount = 0;
    var maxHintUsed = 0;

    // 依題目識別碼統計作答次數，區分首次作答與重複練習
    var qAttemptCounter = {};

    list.forEach(function (item) {
      var qKey = item.questionId || "UNKNOWN";
      qAttemptCounter[qKey] = (qAttemptCounter[qKey] || 0) + 1;
      var attemptNum = qAttemptCounter[qKey];
      var isFirstTry = attemptNum === 1;

      if (isFirstTry) {
        firstTryCount += 1;
        if (item.isCorrect) firstTryCorrectCount += 1;
      } else {
        repeatAttemptCount += 1;
        if (item.isCorrect) repeatCorrectCount += 1;
      }

      var hNum = item.hintLevel ? parseInt(String(item.hintLevel).replace("H", ""), 10) || 0 : 0;
      if (hNum > maxHintUsed) maxHintUsed = hNum;

      if (item.dimension && perDimLogs[item.dimension]) {
        perDimLogs[item.dimension].push({
          isCorrect: Boolean(item.isCorrect),
          isFirstTry: isFirstTry
        });
      }
    });

    var dimensionResults = {};
    var qualifiedDimensionsCount = 0;
    var masteredDimensionsCount = 0;

    ["概念理解", "基礎運算", "推理能力", "應用能力"].forEach(function (dimName) {
      var arr = perDimLogs[dimName];
      var validCount = arr.length;
      if (validCount < minReq) {
        dimensionResults[dimName] = {
          state: "尚需更多練習",
          detail: "有效作答 " + validCount + "/" + minReq + " 筆（實驗參數門檻）"
        };
      } else {
        qualifiedDimensionsCount += 1;
        var dimFirsts = arr.filter(function (x) { return x.isFirstTry; });
        var dimFirstOk = dimFirsts.filter(function (x) { return x.isCorrect; }).length;
        var ratio = dimFirsts.length > 0 ? dimFirstOk / dimFirsts.length : 0;
        var dimState = ratio >= EXPERIMENTAL_PARAMS.masteryMinFirstTryRatio ? "精熟" : ratio >= EXPERIMENTAL_PARAMS.progressMinRatio ? "穩定進步" : "需要加強";
        if (dimState === "精熟") masteredDimensionsCount += 1;
        dimensionResults[dimName] = {
          state: dimState,
          detail: "首次作答 " + dimFirstOk + "/" + dimFirsts.length + " 正確（累計 " + validCount + " 次）"
        };
      }
    });

    // 第 5 維度：獨立完成程度（看首次作答是否少依賴提示，並納入補救題作為證據之一）
    if (firstTryCount < minReq) {
      dimensionResults["獨立完成程度"] = {
        state: "尚需更多練習",
        detail: "首次作答 " + firstTryCount + "/" + minReq + " 筆" + (remedialPassed ? "・補救題已通過（證據之一）" : "")
      };
    } else {
      qualifiedDimensionsCount += 1;
      var indState = "需要加強";
      if (firstTryCorrectCount / firstTryCount >= EXPERIMENTAL_PARAMS.masteryMinFirstTryRatio && maxHintUsed <= 2) {
        indState = "精熟";
        masteredDimensionsCount += 1;
      } else if (firstTryCorrectCount / firstTryCount >= EXPERIMENTAL_PARAMS.progressMinRatio) {
        indState = "穩定進步";
      }
      dimensionResults["獨立完成程度"] = {
        state: indState,
        detail:
          "首次正確 " +
          firstTryCorrectCount +
          "/" +
          firstTryCount +
          "（重複練習 " +
          repeatCorrectCount +
          "/" +
          repeatAttemptCount +
          " 正確，不灌水）" +
          (remedialPassed ? "・補救題已通過" : "")
      };
    }

    // 整體狀態：絕不只答對 1 題就判精熟，且需有足夠維度達標
    var overallStatus = "尚需更多練習";
    if (qualifiedDimensionsCount < 2 || firstTryCount < 2) {
      overallStatus = "尚需更多練習";
    } else if (masteredDimensionsCount >= 3 && firstTryCorrectCount >= 2 && maxHintUsed <= 2) {
      overallStatus = "精熟";
    } else if (firstTryCorrectCount >= 1 || repeatCorrectCount >= 1) {
      overallStatus = "穩定進步";
    } else {
      overallStatus = "需要加強";
    }

    return {
      overallStatus: overallStatus,
      dimensionsOrder: dimsOrder,
      dimensions: dimensionResults,
      summaryLine:
        "實驗參數計算｜首次作答正確：" +
        firstTryCorrectCount +
        "/" +
        firstTryCount +
        "｜重複練習正確：" +
        repeatCorrectCount +
        "/" +
        repeatAttemptCount +
        "｜補救題證據：" +
        (remedialPassed ? "已通過" : "未通過或尚未作答"),
      params: EXPERIMENTAL_PARAMS
    };
  }

  // 7. 教學引擎核心狀態與推進邏輯
  var engineState = {
    selectedNodeId: "M1-01"
  };

  function getCurrentStudentId() {
    var nameEl = document.getElementById("stuInp");
    var fromDom = nameEl && nameEl.value ? nameEl.value.trim() : "";
    var fromStore = (localStorage.getItem("edu_stu") || "").trim();
    return fromDom || fromStore || "訪客學員";
  }

  function getNextHintLevel(session) {
    var order = ["H1", "H2",

/* 第二階段：學生端教學引擎 - 第二輪修正（完整版，規則式教學・實驗參數模式） */
(function () {
  "use strict";

  // 0. 可調整實驗參數（非教育研究驗證定論，僅供系統實驗調整）
  var EXPERIMENTAL_PARAMS = {
    minDistinctQuestionsPerDimension: 2, // 各維度需至少 2 題「不同題目識別碼」的有效作答，否則顯示「尚需更多練習」
    masteryMinFirstTryRatio: 0.75,       // 「精熟」首次作答正確率實驗門檻
    progressMinRatio: 0.40               // 「穩定進步」作答正確率實驗門檻
  };

  // 1. 內部錯誤分類（僅供系統內部記錄與診斷，不直接顯示代碼給學生）
  var ERROR_TAXONOMY = {
    E01: "定義理解錯誤",
    E02: "性質使用錯誤",
    E03: "忽略適用條件",
    E04: "運算錯誤",
    E05: "推論錯誤",
    E06: "題意理解或建模錯誤",
    E07: "抄寫或計算疏失"
  };

  // 2. 依具體錯誤成因提供不同引導（錯誤分類與學生回饋分離）
  function resolveSpecificRemediation(errorCode, rawAnswer, nodeId, customContext) {
    var ans = String(rawAnswer || "").trim();

    if (customContext === "contradiction_sign") {
      return {
        encouragement: "這句說法把正負號的奇偶規律寫反了，我們一起重新對照乘方的符號規則。",
        coaching: "當底數為負數時，偶數次方（如 2 次、4 次）相乘後為正數；奇數次方（如 1 次、3 次）相乘後為負數。"
      };
    }

    if (customContext === "zero_power_includes_zero") {
      return {
        encouragement: "前半句提到非零數的零次方為 1 很有概念，但「包括 0」這部分需要修正。",
        coaching: "零指數成立的前提是「底數不能為 0」；0 的 0 次方在國中／高中數學中不列入 a^0 = 1 的一般規定。"
      };
    }

    if (errorCode === "E01") {
      if (nodeId === "M1-01" && (ans.indexOf("6") !== -1 || ans.indexOf("15") !== -1 || ans.indexOf("×") !== -1)) {
        return {
          encouragement: "你把次方和乘法聯想在一起了，不過次方是指「相同底數連續相乘」，不是直接相乘。",
          coaching: "把次方寫成連乘算式看看：例如 2 的 3 次方是 2 × 2 × 2 = 8。"
        };
      }
      if (nodeId === "M1-02" && ans.indexOf("0") !== -1) {
        return {
          encouragement: "看到 0 次方想到 0 是常見直覺，但非零數的 0 次方結果是 1，不是 0。",
          coaching: "想想看同一個非零數自己除自己（例如 5^2 ÷ 5^2）的規律，結果會是多少？"
        };
      }
      return {
        encouragement: "我們先回到這個觀念的核心定義，看看題目問的是哪一種關係。",
        coaching: "先辨識題目中的底數與次方各代表什麼，再判斷算式。"
      };
    }

    if (errorCode === "E02") {
      return {
        encouragement: "在括號範圍或次方性質的運用上有一點小偏差，我們先看清楚次方作用在誰身上。",
        coaching: "有括號包住負號時，次方作用在整個括號內；沒有括號時，先算次方再看前面的負號。"
      };
    }

    if (errorCode === "E03") {
      return {
        encouragement: "算式方向接近了，但這題還要特別留意「底數不能為 0」的適用條件。",
        coaching: "把零指數底數的整串式子拿出來，列出「底數 ≠ 0」再推導未知數條件。"
      };
    }

    if (errorCode === "E04") {
      return {
        encouragement: "觀念方向不錯，計算過程中在正負號或數字運算上遇到一點小阻礙。",
        coaching: "先把每一項的數值與正負號算出來，再一步一步做加減。"
      };
    }

    if (errorCode === "E05") {
      return {
        encouragement: "你的作答還缺少完整的推論連結，我們把理由說得更清楚一些。",
        coaching: "試著說明「因為符合哪個規則，所以得到這個結果」。"
      };
    }

    if (errorCode === "E06") {
      return {
        encouragement: "題目條件與你的作答還沒完全對齊，我們先看清楚題目要問的是什麼。",
        coaching: "先找出題目給的條件與最後要回答的對象（例如是「組數」還是「數值」）。"
      };
    }

    return {
      encouragement: "可能是看題或抄寫時不小心看漏了符號或數字，放慢腳步再檢查一次。",
      coaching: "對照題目上的數字與正負號，逐一確認後再送出。"
    };
  }

  // 3. 文字解釋判斷器（檢查概念完整度與矛盾陳述，區分 pass / partial / incorrect / unclear，並預留未來 AI 語意分析介面）
  var SemanticAnalyzerHook = {
    // 未來可掛載外部 AI 語意分析函式：(payload) => ({ verdict: "pass"|"partial"|"incorrect"|"unclear", errorCode: ..., supplementPrompt: ..., contextKey: ... })
    customAnalyzer: null,

    analyzeExplanation: function (payload) {
      if (typeof this.customAnalyzer === "function") {
        return this.customAnalyzer(payload);
      }

      var raw = String((payload && payload.answer) || "").trim();
      var lower = raw.toLowerCase();

      // 空字串或單一字／純數字：無法可靠判斷，要求補充說明
      if (!raw || raw.length <= 1 || /^[\+\-]?\d+$/.test(raw)) {
        return {
          verdict: "unclear",
          errorCode: "E05",
          contextKey: null,
          supplementPrompt:
            "只寫單一字詞或數字還看不出你的想法，請用完整的句子補充說明你的理由。"
        };
      }

      if (payload.nodeId === "M1-01") {
        // 檢查互相矛盾或錯誤的奇偶次方正負號陳述
        var hasOddPos =
          (lower.indexOf("奇") !== -1 && lower.indexOf("正") !== -1 && lower.indexOf("奇數次方是負") === -1 && lower.indexOf("奇數次方為負") === -1) ||
          (lower.indexOf("(-2)^3") !== -1 && lower.indexOf("正") !== -1 && lower.indexOf("負") === -1);
        var hasEvenNeg =
          (lower.indexOf("偶") !== -1 && lower.indexOf("負") !== -1 && lower.indexOf("偶數次方是正") === -1 && lower.indexOf("偶數次方為正") === -1) ||
          (lower.indexOf("(-2)^4") !== -1 && lower.indexOf("負") !== -1 && lower.indexOf("正") === -1);

        if (hasOddPos || hasEvenNeg) {
          return {
            verdict: "incorrect",
            errorCode: "E02",
            contextKey: "contradiction_sign",
            supplementPrompt: null
          };
        }

        var hasOddNeg = lower.indexOf("奇") !== -1 && lower.indexOf("負") !== -1;
        var hasEvenPos = lower.indexOf("偶") !== -1 && lower.indexOf("正") !== -1;
        var hasBracketOrPower =
          lower.indexOf("括號") !== -1 ||
          lower.indexOf("連乘") !== -1 ||
          lower.indexOf("次方") !== -1 ||
          lower.indexOf("-8") !== -1 ||
          lower.indexOf("16") !== -1;

        if ((hasOddNeg && hasEvenPos) || ((hasOddNeg || hasEvenPos) && hasBracketOrPower)) {
          return { verdict: "pass", errorCode: null, contextKey: null, supplementPrompt: null };
        }

        if (hasOddNeg || hasEvenPos || hasBracketOrPower) {
          return {
            verdict: "partial",
            errorCode: "E05",
            contextKey: null,
            supplementPrompt:
              "你已經提到一部分重點了！請再補充說明「奇數次方與偶數次方」各自對應的正負號或括號影響。"
          };
        }

        return {
          verdict: "unclear",
          errorCode: "E01",
          contextKey: null,
          supplementPrompt:
            "目前的說明還看不出與負數次方正負號規律的關聯，請補充說明奇數次方與偶數次方分別會得到正數或負數。"
        };
      }

      // M1-02 零指數除法規律與底數限制說明
      var includesZero =
        lower.indexOf("包括 0") !== -1 ||
        lower.indexOf("包括0") !== -1 ||
        lower.indexOf("包含 0") !== -1 ||
        lower.indexOf("包含0") !== -1 ||
        lower.indexOf("0 的 0 次方") !== -1 ||
        lower.indexOf("0的0次方") !== -1 ||
        (lower.indexOf("任何數") !== -1 && lower.indexOf("0") !== -1 && lower.indexOf("不") === -1 && lower.indexOf("≠") === -1 && lower.indexOf("除") === -1);

      if (includesZero && (lower.indexOf("零次方") !== -1 || lower.indexOf("0 次方") !== -1 || lower.indexOf("0次方") !== -1)) {
        return {
          verdict: "incorrect",
          errorCode: "E03",
          contextKey: "zero_power_includes_zero",
          supplementPrompt: null
        };
      }

      var mentionsDivision =
        lower.indexOf("除") !== -1 ||
        lower.indexOf("相減") !== -1 ||
        lower.indexOf("自己") !== -1 ||
        lower.indexOf("相同") !== -1;
      var mentionsOneAndNonZero =
        (lower.indexOf("1") !== -1 || lower.indexOf("一") !== -1) &&
        (lower.indexOf("不為 0") !== -1 ||
          lower.indexOf("不為0") !== -1 ||
          lower.indexOf("非零") !== -1 ||
          lower.indexOf("≠") !== -1 ||
          lower.indexOf("不能為 0") !== -1 ||
          lower.indexOf("不能為0") !== -1);

      if (mentionsDivision && (lower.indexOf("1") !== -1 || lower.indexOf("一") !== -1)) {
        return { verdict: "pass", errorCode: null, contextKey: null, supplementPrompt: null };
      }

      if (mentionsDivision || mentionsOneAndNonZero) {
        return {
          verdict: "partial",
          errorCode: "E05",
          contextKey: null,
          supplementPrompt:
            "你已經提到一部分概念了！請再補充說明「相同非零數相除為 1」或「指數相減得到零次方」的關聯。"
        };
      }

      return {
        verdict: "unclear",
        errorCode: "E01",
        contextKey: null,
        supplementPrompt:
          "這段說明還沒有清楚連結到除法規律或非零底數的條件，請用自己的話再補充說明。"
      };
    }
  };

  // 4. 既有 M1-01、M1-02 教材（完整保留原始教材）與人工驗算後之六階段／補救題設定
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
        expectedAnswerDesc: "正確說明奇數次方為負、偶數次方為正（且無矛盾陳述）",
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
          if (u === "A") return { verdict: "incorrect", ok: false, errorCode: "E02", contextKey: "contradiction_sign" };
          if (u === "C") return { verdict: "incorrect", ok: false, errorCode: "E01", contextKey: null };
          return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入 A、B 或 C 其中一個選項。" };
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
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入整數數值結果。" };
          }
          if (t === "17") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "-1" || t === "1" || t === "-17") return { verdict: "incorrect", ok: false, errorCode: "E02", contextKey: "contradiction_sign" };
          if (t === "15" || t === "12") return { verdict: "incorrect", ok: false, errorCode: "E07", contextKey: null };
          return { verdict: "incorrect", ok: false, errorCode: "E04", contextKey: null };
        }
      },
      // 人工驗算：邊長 2 公尺的正方形面積為 2^2 = 4（平方公尺）；(-2)^3 = (-2)×(-2)×(-2) = -8；4 + (-8) = -4
      stage5Remedial: {
        questionId: "M1-01-S5-REMEDIAL",
        dimension: "應用能力",
        contextNote: "情境轉換：正方形地墊面積（2^2 = 4）與負數三次方數值（(-2)^3 = -8）合併計算",
        prompt:
          "【個人化補救題】一塊邊長為 2 公尺的正方形地墊，面積為 2^2 = 4 平方公尺；另有一個負數三次方算式 (-2)^3（表示 (-2) 連乘 3 次）。請問「正方形面積（4）」加上「(-2)^3 的值」是多少？（請輸入整數，例如 -4）",
        expectedAnswer: "-4",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請輸入計算結果。" };
          if (!/^[\+\-]?\d+$/.test(t)) {
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入整數數值結果。" };
          }
          if (t === "-4") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "12" || t === "4") return { verdict: "incorrect", ok: false, errorCode: "E02", contextKey: "contradiction_sign" };
          return { verdict: "incorrect", ok: false, errorCode: "E04", contextKey: null };
        }
      },
      hints: {
        H1: "先回想次方代表「連續相乘的次數」，並留意括號有沒有把負號包進去。",
        H2: "先分別看清楚每一項的底數與次方，再決定正負號與數值。",
        H3: "先算個別次方值（例如 2^2 = 4，(-2)^3 = -8），再依題意相加。",
        H4: "完整解析：2^2 = 4，(-2)^3 = (-2)×(-2)×(-2) = -8，4 + (-8) = -4。"
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
        expectedAnswerDesc: "說明非零數相除等於 1，且底數不可為 0",
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
          if (u === "A") return { verdict: "incorrect", ok: false, errorCode: "E03", contextKey: "zero_power_includes_zero" };
          if (u === "C") return { verdict: "incorrect", ok: false, errorCode: "E07", contextKey: null };
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
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入整數數值結果。" };
          }
          if (t === "8") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "7" || t === "2" || t === "0") return { verdict: "incorrect", ok: false, errorCode: "E01", contextKey: null };
          if (t === "9") return { verdict: "incorrect", ok: false, errorCode: "E07", contextKey: null };
          return { verdict: "incorrect", ok: false, errorCode: "E04", contextKey: null };
        }
      },
      // 人工驗算：明確區分「組數」與「人數」。現有 3 組（每組 4 人，共 12 人），另增 1 組（以 6^0 = 1 組表示，有 4 人）。總組數 = 3 + 6^0 = 3 + 1 = 4 組。
      stage5Remedial: {
        questionId: "M1-02-S5-REMEDIAL",
        dimension: "應用能力",
        contextNote: "情境轉換：明確區分「組數」與「人數」（每組 4 人；現有 3 組共 12 人，新增 6^0 = 1 組有 4 人）",
        prompt:
          "【個人化補救題】社團活動中，每組有 4 人。目前已有 3 組（共 12 人），另外成立 1 個新小組，其組數以 6^0（等於 1 組，該組有 4 人）表示。請問目前共有幾「組」（3 + 6^0）？",
        expectedAnswer: "4",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { verdict: "unclear", ok: false, errorCode: "E06", supplementPrompt: "請輸入總組數。" };
          if (!/^[\+\-]?\d+$/.test(t)) {
            return { verdict: "unclear", ok: false, errorCode: "E05", supplementPrompt: "請輸入整數組數。" };
          }
          if (t === "4") return { verdict: "pass", ok: true, errorCode: null };
          if (t === "16" || t === "12") return { verdict: "incorrect", ok: false, errorCode: "E06", contextKey: null };
          if (t === "3") return { verdict: "incorrect", ok: false, errorCode: "E01", contextKey: null };
          return { verdict: "incorrect", ok: false, errorCode: "E04", contextKey: null };
        }
      },
      hints: {
        H1: "先提醒自己：底數不為 0 時，零次方的結果是 1；同時看清楚題目問的是「組數」還是「人數」。",
        H2: "把「現有組數」與「新增組數」分開看，不要和每組人數混在一起。",
        H3: "先算 6^0 = 1（代表 1 組），再把原本的 3 組加上這 1 組。",
        H4: "完整解析：6^0 = 1，總組數為 3 + 1 = 4 組（若算總人數則是 4 組 × 4 人 = 16 人）。"
      }
    }
  };

  // 5. 學習紀錄儲存層（與教學邏輯分離）
  var STORAGE_KEY = "ai_edu_phase2_records_v2";

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

  // 6. 依作答次數取得下一個提示層級（完整補全函式）
  function getNextHintLevel(session) {
    var order = ["H1", "H2", "H3", "H4"];
    var currentIdx = typeof session.hintLevelIndex === "number" ? session.hintLevelIndex : 0;
    var safeIdx = Math.max(0, Math.min(currentIdx, order.length - 1));
    var chosenLevel = order[safeIdx];
    session.hintLevelIndex = Math.min(safeIdx + 1, order.length - 1);
    return chosenLevel;
  }

  // 7. 五維度獨立精熟度計算器（計算不同題目識別碼數量、區分首次與重複作答、不混算總正確率）
  function evaluateFiveDimensions(logs, remedialPassed) {
    var list = Array.isArray(logs) ? logs : [];
    var minDistinct = EXPERIMENTAL_PARAMS.minDistinctQuestionsPerDimension;
    var dimsOrder = ["概念理解", "基礎運算", "推理能力", "應用能力", "獨立完成程度"];

    // 依題目識別碼追蹤首次作答與累計次數（同一題重複作答不增加「不同題目數」）
    var questionAttemptMap = {};
    var distinctQuestionsByDim = {
      概念理解: {},
      基礎運算: {},
      推理能力: {},
      應用能力: {}
    };
    var firstTryLogsByDim = {
      概念理解: [],
      基礎運算: [],
      推理能力: [],
      應用能力: []
    };

    var firstTryTotal = 0;
    var firstTryCorrect = 0;
    var repeatTotal = 0;
    var repeatCorrect = 0;
    var maxHintNum = 0;
    var distinctAllQuestions = {};

    list.forEach(function (item) {
      var qId = item.questionId || "UNKNOWN";
      questionAttemptMap[qId] = (questionAttemptMap[qId] || 0) + 1;
      var isFirstTry = questionAttemptMap[qId] === 1;
      distinctAllQuestions[qId] = true;

      if (isFirstTry) {
        firstTryTotal += 1;
        if (item.isCorrect) firstTryCorrect += 1;
      } else {
        repeatTotal += 1;
        if (item.isCorrect) repeatCorrect += 1;
      }

      if (item.hintLevel) {
        var hNum = parseInt(String(item.hintLevel).replace("H", ""), 10) || 0;
        if (hNum > maxHintNum) maxHintNum = hNum;
      }

      if (item.dimension && distinctQuestionsByDim[item.dimension]) {
        distinctQuestionsByDim[item.dimension][qId] = true;
        if (isFirstTry) {
          firstTryLogsByDim[item.dimension].push(Boolean(item.isCorrect));
        }
      }
    });

    var dimensionResults = {};
    var qualifiedCount = 0;
    var masteredDimCount = 0;

    ["概念理解", "基礎運算", "推理能力", "應用能力"].forEach(function (dim) {
      var distinctCount = Object.keys(distinctQuestionsByDim[dim]).length;
      var firstArr = firstTryLogsByDim[dim];

      if (distinctCount < minDistinct) {
        dimensionResults[dim] = {
          state: "尚需更多練習",
          detail: "不同題目 " + distinctCount + "/" + minDistinct + " 題（重複同題不計入不同題數）"
        };
      } else {
        qualifiedCount += 1;
        var okFirst = firstArr.filter(function (v) { return v; }).length;
        var ratio = firstArr.length > 0 ? okFirst / firstArr.length : 0;
        var state = "需要加強";
        if (r

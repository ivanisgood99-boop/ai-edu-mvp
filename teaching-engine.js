/* 第二階段：學生端教學引擎 - 修復版（規則式判斷・實驗參數模式，非真正 AI） */
(function () {
  "use strict";

  var EXPERIMENTAL_PARAMS = {
    minDistinctQuestionsPerDimension: 1,
    minDistinctQuestionsForOverallMastery: 3,
    masteryMinFirstTryRatio: 0.75,
    progressMinRatio: 0.40,
    maxHintLevelForMastery: 2
  };

  var ERROR_TAXONOMY = {
    E01: "定義理解錯誤",
    E02: "性質使用錯誤",
    E03: "忽略適用條件",
    E04: "運算錯誤",
    E05: "推論錯誤",
    E06: "題意理解或建模錯誤",
    E07: "抄寫或計算疏失"
  };

  var STORAGE_KEY = "ai_edu_phase2_records_v3";

  function makeResult(verdict, ok, errorCode, options) {
    var opts = options || {};
    return {
      verdict: verdict,
      ok: Boolean(ok),
      errorCode: ok ? null : (errorCode || "E05"),
      contextKey: opts.contextKey || null,
      supplementPrompt: opts.supplementPrompt || null
    };
  }

  function resolveSpecificRemediation(errorCode, rawAnswer, nodeId, contextKey) {
    var ans = String(rawAnswer || "").trim();

    if (contextKey === "contradiction_sign") {
      return {
        encouragement: "這句說法把正負號的奇偶規律寫反了，我們一起重新對照乘方的符號規則。",
        coaching: "底數為負數時，偶數次方相乘為正數；奇數次方相乘為負數。"
      };
    }

    if (contextKey === "zero_power_includes_zero") {
      return {
        encouragement: "提到非零數的零次方為 1 有抓到一部分，但「包括 0」需要修正。",
        coaching: "零指數的前提是「底數不能為 0」；0 的 0 次方不在一般 a^0 = 1 規定內。"
      };
    }

    if (contextKey === "division_without_nonzero_rule") {
      return {
        encouragement: "你提到了除法與 1 的關聯，但還需要把「同底數相除指數相減」與「底數不可為 0」串起來。",
        coaching: "想想看：a^n ÷ a^n = a^(n-n) = a^0 = 1，前提是底數 a 不能為 0。"
      };
    }

    if (errorCode === "E01") {
      if (nodeId === "M1-01" && (ans.indexOf("6") !== -1 || ans.indexOf("15") !== -1 || ans.indexOf("×") !== -1)) {
        return {
          encouragement: "次方是「相同底數連續相乘」，不是直接把底數乘以次數。",
          coaching: "先把底數寫出來連乘看看，例如 2^3 是 2 × 2 × 2 = 8。"
        };
      }
      if (nodeId === "M1-02" && ans === "0") {
        return {
          encouragement: "看到 0 次方想到 0 是常見直覺，但非零數的 0 次方結果是 1，不是 0。",
          coaching: "用同一個非零數自己除自己（如 5^2 ÷ 5^2）想想看規律。"
        };
      }
      return {
        encouragement: "我們先回到這個觀念的定義，看看題目問的是哪一種關係。",
        coaching: "先確認底數與次方各自代表什麼，再判斷算式。"
      };
    }

    if (errorCode === "E02") {
      return {
        encouragement: "括號範圍或次方性質的運用有一點偏差，先看清楚次方作用在誰身上。",
        coaching: "有括號包住負號時作用在整個括號；沒有括號時先算次方再看負號。"
      };
    }

    if (errorCode === "E03") {
      return {
        encouragement: "方向接近了，但這題還要特別留意「底數不能為 0」的適用條件。",
        coaching: "把零指數底數寫出來，列出「底數 ≠ 0」再推導條件。"
      };
    }

    if (errorCode === "E04") {
      return {
        encouragement: "觀念方向不錯，計算過程中在正負號或數字運算遇到小阻礙。",
        coaching: "先把每一項的數值與正負號算出來，再一步一步做加減。"
      };
    }

    if (errorCode === "E05") {
      return {
        encouragement: "推論過程還缺少完整的連結，我們把理由說得更清楚一些。",
        coaching: "試著用「因為……所以……」說出你的推論依據。"
      };
    }

    if (errorCode === "E06") {
      return {
        encouragement: "題目條件與作答還沒完全對齊，先看清楚題目問的是什麼。",
        coaching: "先找出題目給的條件與最後要回答的項目。"
      };
    }

    return {
      encouragement: "可能是看題或抄寫時不小心看漏了符號或數字，放慢腳步再檢查一次。",
      coaching: "對照題目數字與正負號，逐一確認後再送出。"
    };
  }
  var SemanticHook = {
    customAnalyzer: null,
    analyzeExplanation: function (payload) {
      if (typeof this.customAnalyzer === "function") {
        var customRes = this.customAnalyzer(payload);
        if (customRes && typeof customRes.verdict === "string") {
          return makeResult(customRes.verdict, customRes.verdict === "pass", customRes.errorCode, customRes);
        }
      }

      var raw = String((payload && payload.answer) || "").trim();
      var lower = raw.toLowerCase();

      if (!raw || raw.length <= 1 || /^[\+\-]?\d+$/.test(raw)) {
        return makeResult("unclear", false, "E05", {
          supplementPrompt: "只寫單一字詞或數字還看不出你的推理，請用完整句子說明理由。"
        });
      }

      if (payload.nodeId === "M1-01") {
        var oddSaysPositive =
          (lower.indexOf("奇數") !== -1 && lower.indexOf("正") !== -1 && lower.indexOf("奇數次方是負") === -1 && lower.indexOf("奇數次方為負") === -1 && lower.indexOf("奇數次方負") === -1) ||
          (lower.indexOf("(-2)^3") !== -1 && lower.indexOf("正") !== -1 && lower.indexOf("負") === -1);
        var evenSaysNegative =
          (lower.indexOf("偶數") !== -1 && lower.indexOf("負") !== -1 && lower.indexOf("偶數次方是正") === -1 && lower.indexOf("偶數次方為正") === -1 && lower.indexOf("偶數次方正") === -1) ||
          (lower.indexOf("(-2)^4") !== -1 && lower.indexOf("負") !== -1 && lower.indexOf("正") === -1);

        if (oddSaysPositive || evenSaysNegative || (lower.indexOf("奇數為正") !== -1 && lower.indexOf("偶數為正") !== -1)) {
          return makeResult("incorrect", false, "E02", { contextKey: "contradiction_sign" });
        }

        var hasOddNeg = (lower.indexOf("奇") !== -1 && lower.indexOf("負") !== -1) || lower.indexOf("-8") !== -1;
        var hasEvenPos = (lower.indexOf("偶") !== -1 && lower.indexOf("正") !== -1) || lower.indexOf("16") !== -1;
        var hasBracketConcept = lower.indexOf("括號") !== -1 || lower.indexOf("連乘") !== -1 || lower.indexOf("底數") !== -1;

        if (hasOddNeg && hasEvenPos) {
          return makeResult("pass", true, null);
        }
        if (hasOddNeg || hasEvenPos || hasBracketConcept) {
          return makeResult("partial", false, "E05", {
            supplementPrompt: "你的說明還不夠完整，請補充說明負數的奇數次方與偶數次方各自的正負號規律。"
          });
        }
        return makeResult("unclear", false, "E01", {
          supplementPrompt: "這段說明還看不出與負數次方正負號規律的關聯，請用自己的話補充說明。"
        });
      }

      var includesZeroPower =
        lower.indexOf("包括 0") !== -1 || lower.indexOf("包括0") !== -1 ||
        lower.indexOf("包含 0") !== -1 || lower.indexOf("包含0") !== -1 ||
        lower.indexOf("0 的 0 次方") !== -1 || lower.indexOf("0的0次方") !== -1 ||
        (lower.indexOf("任何數") !== -1 && lower.indexOf("0") !== -1 && lower.indexOf("不") === -1 && lower.indexOf("≠") === -1 && lower.indexOf("除") === -1);

      if (includesZeroPower && (lower.indexOf("零次方") !== -1 || lower.indexOf("0 次方") !== -1 || lower.indexOf("0次方") !== -1)) {
        return makeResult("incorrect", false, "E03", { contextKey: "zero_power_includes_zero" });
      }

      var hasDivOrSub = lower.indexOf("除") !== -1 || lower.indexOf("相減") !== -1 || lower.indexOf("自己") !== -1 || lower.indexOf("相同") !== -1;
      var hasOne = lower.indexOf("1") !== -1 || lower.indexOf("一") !== -1;
      var hasNonZeroCond = lower.indexOf("不為 0") !== -1 || lower.indexOf("不為0") !== -1 || lower.indexOf("非零") !== -1 || lower.indexOf("≠") !== -1 || lower.indexOf("不能為 0") !== -1 || lower.indexOf("不能為0") !== -1;

      if (hasDivOrSub && hasOne && hasNonZeroCond) return makeResult("pass", true, null);
      if (hasDivOrSub && hasOne && !hasNonZeroCond) {
        return makeResult("partial", false, "E03", {
          contextKey: "division_without_nonzero_rule",
          supplementPrompt: "你提到相除與 1 的關係，請再補充說明「底數不能為 0」這個條件。"
        });
      }
      if (hasDivOrSub || hasOne || hasNonZeroCond) {
        return makeResult("partial", false, "E05", {
          supplementPrompt: "你抓到部分線索了，請再補充「相同非零數相除為 1」或「同底數相除指數相減」的完整理由。"
        });
      }
      return makeResult("unclear", false, "E01", {
        supplementPrompt: "這段說明還沒有清楚連結到除法規律或非零底數條件，請再補充說明。"
      });
    }
  };

  var NODES = {
    "M1-01": {
      id: "M1-01", code: "M1-01", title: "M1-01 正整數指數",
      stage1Material: "【教材重點｜M1-01 正整數指數】\n1. 定義：設 a 為任意實數，n 為正整數，a^n 表示 n 個 a 連續相乘（a × a × ... × a，共 n 個）。\n2. 正例：2^3 = 2 × 2 × 2 = 8；(-3)^2 = (-3) × (-3) = 9。\n3. 反例與提醒：2^3 不是 2 × 3 = 6；-3^2 代表 -(3 × 3) = -9，與 (-3)^2 不同。",
      stage2Guide: {
        questionId: "M1-01-S2-GUIDE", dimension: "推理能力",
        prompt: "想一想：當底數是負數時，次方次數是奇數或偶數，結果的正負號有什麼不同？請用自己的話說明為什麼 (-2)^3 與 (-2)^4 的正負號不同。",
        expectedAnswerDesc: "說明奇數次方為負、偶數次方為正，且無矛盾陳述",
        validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); }
      },
      stage3Check: {
        questionId: "M1-01-S3-CHECK", dimension: "概念理解",
        prompt: "【理解檢查】下列哪一個算式的值與 -5^2 相等？（請輸入 A、B 或 C）\nA. (-5)^2\nB. -(5 × 5)\nC. (-5) × 2",
        expectedAnswer: "B",
        validate: function (v) {
          var u = String(v || "").trim().toUpperCase();
          if (!u) return makeResult("unclear", false, "E06", { supplementPrompt: "請輸入選項 A、B 或 C。" });
          if (u === "B") return makeResult("pass", true, null);
          if (u === "A") return makeResult("incorrect", false, "E02", { contextKey: "contradiction_sign" });
          if (u === "C") return makeResult("incorrect", false, "E01");
          return makeResult("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C 其中一個選項。" });
        }
      },
      stage4Practice: {
        questionId: "M1-01-S4-PRACTICE", dimension: "基礎運算",
        prompt: "【互動練習】請計算 2^3 + (-3)^2 的值是多少？",
        expectedAnswer: "17",
        validate: function (v) {
          var t = String(v || "").trim();
          if (!t) return makeResult("unclear", false, "E06", { supplementPrompt: "請輸入計算結果。" });
          if (!/^[\+\-]?\d+$/.test(t)) return makeResult("unclear", false, "E05", { supplementPrompt: "請輸入整數數值。" });
          if (t === "17") return makeResult("pass", true, null);
          if (t === "-1" || t === "1" || t === "-17") return makeResult("incorrect", false, "E02", { contextKey: "contradiction_sign" });
          if (t === "15" || t === "12") return makeResult("incorrect", false, "E07");
          return makeResult("incorrect", false, "E04");
        }
      },
      stage5Remedial: {
        questionId: "M1-01-S5-REMEDIAL", dimension: "應用能力",
        contextNote: "情境轉換：正方形地墊面積（2^2 = 4）與負數三次方（(-2)^3 = -8）合併計算",
        prompt: "【個人化補救題】一塊邊長為 2 公尺的正方形地墊，面積為 2^2 = 4 平方公尺；另有 (-2)^3（表示 (-2) 連乘 3 次）。請問「正方形面積（4）」加上「(-2)^3 的值」是多少？（例如 -4）",
        expectedAnswer: "-4",
        validate: function (v) {
          var t = String(v || "").trim();
          if (!t) return makeResult("unclear", false, "E06", { supplementPrompt: "請輸入計算結果。" });
          if (!/^[\+\-]?\d+$/.test(t)) return makeResult("unclear", false, "E05", { supplementPrompt: "請輸入整數數值。" });
          if (t === "-4") return makeResult("pass", true, null);
          if (t === "12" || t === "4") return makeResult("incorrect", false, "E02", { contextKey: "contradiction_sign" });
          return makeResult("incorrect", false, "E04");
        }
      },
      hints: {
        H1: "先回想次方代表「連續相乘的次數」，並留意括號有沒有把負號包進去。",
        H2: "先分別看清楚每一項的底數與次方，再決定正負號與數值。",
        H3: "先算個別次方值（例如 2^2 = 4，(-2)^3 = -8），再依題意相加。",
        H4: "完整解析：2^2 = 4，(-2)^3 = -8，4 + (-8) = -4。"
      }
    },
    "M1-02": {
      id: "M1-02", code: "M1-02", title: "M1-02 零指數",
      stage1Material: "【教材重點｜M1-02 零指數】\n1. 定義：當底數 a ≠ 0 時，規定 a^0 = 1。\n2. 必要條件：若底數為 0，0^0 在數學上沒有意義，因此底數不能為 0。\n3. 正例與反例：7^0 = 1、(-6)^0 = 1；但 7^0 不等於 0，且 (x - 3)^0 = 1 時 x 必須 ≠ 3。",
      stage2Guide: {
        questionId: "M1-02-S2-GUIDE", dimension: "推理能力",
        prompt: "想一想：如果同底數相除時指數相減，例如 5^2 ÷ 5^2 會得到 5^0；從除法規律來看，為什麼非零數的 0 次方會規定為 1，而不是 0？請用自己的話說明（並留意底數限制）。",
        expectedAnswerDesc: "說明同底數相除／非零數相除為 1，且底數不可為 0",
        validate: function (v, nid) { return SemanticHook.analyzeExplanation({ nodeId: nid, stage: 2, answer: v }); }
      },
      stage3Check: {
        questionId: "M1-02-S3-CHECK", dimension: "概念理解",
        prompt: "【理解檢查】若 (x - 3)^0 = 1 成立，x 必須滿足什麼條件？（請輸入 A、B 或 C）\nA. x 可以是任意實數\nB. x ≠ 3\nC. x > 3",
        expectedAnswer: "B",
        validate: function (v) {
          var u = String(v || "").trim().toUpperCase();
          if (!u) return makeResult("unclear", false, "E06", { supplementPrompt: "請輸入選項 A、B 或 C。" });
          if (u === "B") return makeResult("pass", true, null);
          if (u === "A") return makeResult("incorrect", false, "E03", { contextKey: "zero_power_includes_zero" });
          if (u === "C") return makeResult("incorrect", false, "E07");
          return makeResult("unclear", false, "E05", { supplementPrompt: "請輸入 A、B 或 C 其中一個選項。" });
        }
      },
      stage4Practice: {
        questionId: "M1-02-S4-PRACTICE", dimension: "基礎運算",
        prompt: "【互動練習】請計算 (-6)^0 + 2^3 - 5^0 的值是多少？",
        expectedAnswer: "8",
        validate: function (v) {
          var t = String(v || "").trim();
          if (!t) return makeResult("unclear", false, "E06", { supplementPrompt: "請輸入計算結果。" });
          if (!/^[\+\-]?\d+$/.test(t)) return makeResult("unclear", false, "E05", { supplementPrompt: "請輸入整數數值。" });
          if (t === "8") return makeResult("pass", true, null);
          if (t === "7" || t === "2" || t === "0") return makeResult("incorrect", false, "E01");
          if (t === "9") return makeResult("incorrect", false, "E07");
          return makeResult("incorrect", false, "E04");
        }
      },
      stage5Remedial: {
        questionId: "M1-02-S5-REMEDIAL", dimension: "應用能力",
        contextNote: "情境轉換：明確區分「組數」與「人數」（每組 4 人；現有 3 組共 12 人，新增 6^0 = 1 組有 4 人）",
        prompt: "【個人化補救題】社團活動中，每組有 4 人。目前已有 3 組（共 12 人），另外成立 1 個新小組，其組數以 6^0（等於 1 組，該組有 4 人）表示。請問目前共有幾「組」（3 + 6^0）？",
        expectedAnswer: "4",
        validate: function (v) {
          var t = String(v || "").trim();
          if (!t) return makeResult("unclear", false, "E06", { supplementPrompt: "請輸入總組數。" });
          if (!/^[\+\-]?\d+$/.test(t)) return makeResult("unclear", false, "E05", { supplementPrompt: "請輸入整數組數。" });
          if (t === "4") return makeResult("pass", true, null);
          if (t === "16" || t === "12") return makeResult("incorrect", false, "E06");
          if (t === "3") return makeResult("incorrect", false, "E01");
          return makeResult("incorrect", false, "E04");
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
  var Repo = {
    loadAll: function () {
      try {
        var r = localStorage.getItem(STORAGE_KEY);
        var p = r ? JSON.parse(r) : {};
        return p && typeof p === "object" ? p : {};
      } catch (e) { return {}; }
    },
    saveAll: function (m) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch (e) {}
    },
    getNodeSession: function (sid, nid) {
      var all = this.loadAll();
      var k = (sid || "guest") + "::" + nid;
      return all[k] || {
        studentId: sid || "guest", nodeId: nid, currentStage: 1, unlockedStage: 1,
        hintLevelIndex: 0, remedialPassed: false, lastFeedback: "", lastFeedbackType: "guide", logs: []
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

  function evaluateFiveDimensions(logs, remedialPassed) {
    var list = Array.isArray(logs) ? logs : [];
    var minDimQ = EXPERIMENTAL_PARAMS.minDistinctQuestionsPerDimension;
    var minOverallQ = EXPERIMENTAL_PARAMS.minDistinctQuestionsForOverallMastery;
    var dimsOrder = ["概念理解", "基礎運算", "推理能力", "應用能力", "獨立完成程度"];

    var qAttemptCount = {};
    var dimDistinct = { 概念理解: {}, 基礎運算: {}, 推理能力: {}, 應用能力: {} };
    var dimFirstTryResults = { 概念理解: [], 基礎運算: [], 推理能力: [], 應用能力: [] };
    var allDistinctQuestions = {};
    var firstTryTotal = 0, firstTryCorrect = 0, repeatTotal = 0, repeatCorrect = 0, maxHintNum = 0;

    list.forEach(function (item) {
      var qid = item.questionId || "UNKNOWN";
      qAttemptCount[qid] = (qAttemptCount[qid] || 0) + 1;
      var isFirst = qAttemptCount[qid] === 1;
      allDistinctQuestions[qid] = true;

      if (isFirst) { firstTryTotal += 1; if (item.isCorrect) firstTryCorrect += 1; }
      else { repeatTotal += 1; if (item.isCorrect) repeatCorrect += 1; }

      if (item.hintLevel) {
        var hn = parseInt(String(item.hintLevel).replace("H", ""), 10) || 0;
        if (hn > maxHintNum) maxHintNum = hn;
      }

      if (item.dimension && dimDistinct[item.dimension]) {
        dimDistinct[item.dimension][qid] = true;
        if (isFirst) dimFirstTryResults[item.dimension].push(Boolean(item.isCorrect));
      }
    });

    var out = {}, masteredDimCount = 0, qualifiedDimCount = 0;

    ["概念理解", "基礎運算", "推理能力", "應用能力"].forEach(function (d) {
      var dc = Object.keys(dimDistinct[d]).length;
      var fa = dimFirstTryResults[d];
      if (dc < minDimQ || fa.length === 0) {
        out[d] = { state: "尚需更多練習", detail: "不同題目 " + dc + "/" + minDimQ + " 題（重複同題不計入）" };
      } else {
        qualifiedDimCount += 1;
        var okN = fa.filter(function (x) { return x; }).length;
        var ratio = okN / fa.length;
        var st = ratio >= EXPERIMENTAL_PARAMS.masteryMinFirstTryRatio ? "精熟" : (ratio >= EXPERIMENTAL_PARAMS.progressMinRatio ? "穩定進步" : "需要加強");
        if (st === "精熟") masteredDimCount += 1;
        out[d] = { state: st, detail: "首次正確 " + okN + "/" + fa.length + "（不同題 " + dc + " 題）" };
      }
    });

    var allDistinctCount = Object.keys(allDistinctQuestions).length;
    if (allDistinctCount < minDimQ || firstTryTotal === 0) {
      out["獨立完成程度"] = { state: "尚需更多練習", detail: "尚無足夠作答證據｜補救題：" + (remedialPassed ? "已通過" : "未通過或未作答") };
    } else {
      qualifiedDimCount += 1;
      var firstRatio = firstTryTotal > 0 ? firstTryCorrect / firstTryTotal : 0;
      var indState = (firstRatio >= EXPERIMENTAL_PARAMS.masteryMinFirstTryRatio && maxHintNum <= EXPERIMENTAL_PARAMS.maxHintLevelForMastery)
        ? "精熟" : ((firstRatio >= EXPERIMENTAL_PARAMS.progressMinRatio || repeatCorrect > 0) ? "穩定進步" : "需要加強");
      if (indState === "精熟") masteredDimCount += 1;
      out["獨立完成程度"] = {
        state: indState,
        detail: "首次正確 " + firstTryCorrect + "/" + firstTryTotal + "｜最高提示 H" + maxHintNum + "｜補救題：" + (remedialPassed ? "已通過" : "未通過或未作答")
      };
    }

    var overall = "尚需更多練習";
    if (allDistinctCount < minOverallQ || qualifiedDimCount < 2) overall = "尚需更多練習";
    else if (masteredDimCount >= 3 && firstTryTotal > 0 && (firstTryCorrect / firstTryTotal) >= EXPERIMENTAL_PARAMS.masteryMinFirstTryRatio && maxHintNum <= EXPERIMENTAL_PARAMS.maxHintLevelForMastery) overall = "精熟";
    else if (firstTryCorrect >= 1 || repeatCorrect >= 1) overall = "穩定進步";
    else overall = "需要加強";

    return {
      overallStatus: overall, dimensionsOrder: dimsOrder, dimensions: out,
      summaryLine: "實驗參數｜不同題目數：" + allDistinctCount + "（整體精熟門檻≥" + minOverallQ + "）｜首次正確：" + firstTryCorrect + "/" + firstTryTotal + "｜重複練習：" + repeatCorrect + "/" + repeatTotal + "｜補救題證據：" + (remedialPassed ? "已通過" : "未通過或未作答"),
      params: EXPERIMENTAL_PARAMS
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
        isCorrect: false, verdict: res.verdict, errorCode: res.errorCode || "E05", errorLabel: ERROR_TAXONOMY[res.errorCode || "E05"],
        hintLevel: null, isFirstTry: isFirst, completedAt: new Date().toISOString(), isRemedial: isRem, remedialPassed: false
      });
      s = Repo.getNodeSession(sid, nid);
      s.lastFeedback = (res.verdict === "partial" ? "【觀念部分正確，請再補充】" : "【需要補充說明】") + (res.supplementPrompt || "請再補充你的想法與理由。");
      s.lastFeedbackType = "guide";
      Repo.saveNodeSession(s);
      return;
    }

    var hLv = !res.ok ? getNextHintLevel(s) : null;
    var rem = !res.ok ? resolveSpecificRemediation(res.errorCode, ans, nid, res.contextKey) : null;

    s = Repo.appendAnswerLog(sid, nid, {
      knowledgeNode: node.code, questionId: spec.questionId, dimension: spec.dimension,
      studentAnswer: ans, expectedAnswer: spec.expectedAnswer || spec.expectedAnswerDesc || "",
      isCorrect: Boolean(res.ok), verdict: res.ok ? "pass" : "incorrect",
      errorCode: res.ok ? null : res.errorCode, errorLabel: res.ok ? null : ERROR_TAXONOMY[res.errorCode],
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
      s.lastFeedback = rem.encouragement + "\n" + rem.coaching + "\n【" + hLv + " 提示】" + ht;
      s.lastFeedbackType = "guide";
      Repo.saveNodeSession(s);
    }
  }

  function esc(x) {
    return String(x || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderStageBody(node, s, mEval) {
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
      return "<div class=\"te-dim-item\"><div class=\"te-dim-name\">" + esc(d) + "</div><div class=\"te-dim-val\">" + esc(o.state) + "</div><div style=\"font-size:11px;color:#cbd5e1;margin-top:4px;\">" + esc(o.detail) + "</div></div>";
    }).join("");
    var logsHtml = (s.logs && s.logs.length) ? "<div class=\"te-sub-box\"><strong>作答紀錄明細（原型本機儲存）：</strong><ul class=\"te-log-list\">" + s.logs.map(function (lg) {
      var stTxt = lg.isCorrect ? "正確" : ((lg.verdict === "unclear" || lg.verdict === "partial") ? "需補充說明" : "需再釐清");
      return "<li>" + esc(lg.questionId) + "｜" + (lg.isFirstTry ? "首次作答" : "重複練習") + "｜作答「" + esc(lg.studentAnswer) + "」｜" + stTxt + (lg.hintLevel ? "｜提示 " + esc(lg.hintLevel) : "") + (lg.isRemedial ? "｜補救題" : "") + "</li>";
    }).join("") + "</ul></div>" : "";
    return "<h4 class=\"te-card-title\">階段 6：學習總結（實驗參數計算・非研究驗證定論）</h4><div class=\"te-sub-box\"><strong>整體狀態：</strong>" + esc(mEval.overallStatus) + "\n" + esc(mEval.summaryLine) + "</div><div class=\"te-dim-grid\">" + dimsHtml + "</div>" + logsHtml + "<div class=\"te-actions\"><button type=\"button\" class=\"te-btn secondary\" id=\"te-restart-node\">重新學習此知識點（明確重設）</button></div>";
  }

  function renderTeachingEngine(container, preferredNodeId) {
    if (!container) return;
    if (preferredNodeId && NODES[preferredNodeId]) engState.selectedNodeId = preferredNodeId;
    var sid = getSid();
    var node = NODES[engState.selectedNodeId] || NODES["M1-01"];
    var s = Repo.getNodeSession(sid, node.id);
    var mEval = evaluateFiveDimensions(s.logs, s.remedialPassed);

    var labels = ["1. 教材學習", "2. 引導問題", "3. 理解檢查", "4. 互動練習", "5. 個人化補救", "6. 學習總結"];
    var strip = labels.map(function (lb, i) {
      var n = i + 1;
      var c = "te-stage-step" + (s.currentStage === n ? " active" : (n < s.currentStage ? " done" : "")) + ((n > s.unlockedStage || (s.currentStage >= 2 && n === 1)) ? " locked" : "");
      return "<div class=\"" + c + "\">" + (s.currentStage >= 2 && n === 1 ? "🔒 " : "") + esc(lb) + "</div>";
    }).join("");

    var tabs = Object.keys(NODES).map(function (k) {
      var it = NODES[k];
      return "<button type=\"button\" class=\"te-topic-btn" + (it.id === node.id ? " active" : "") + "\" data-te-node=\"" + esc(it.id) + "\">" + esc(it.title) + "</button>";
    }).join("");

    var fb = s.lastFeedback ? "<div class=\"te-feedback " + (s.lastFeedbackType === "ok" ? "ok" : "guide") + "\">" + esc(s.lastFeedback) + "</div>" : "";

    container.innerHTML = "<section class=\"te-root\"><div class=\"te-header-bar\"><div><strong>第二階段：學生端教學引擎</strong> <span style=\"font-size:12px;color:#94a3b8;\">學員：" + esc(sid) + "｜整體狀態：" + esc(mEval.overallStatus) + "</span></div><span class=\"te-mode-pill\">規則式判斷・實驗參數模式</span></div><div class=\"te-topic-tabs\">" + tabs + "</div><div class=\"te-stage-strip\">" + strip + "</div><div class=\"te-card\">" + renderStageBody(node, s, mEval) + fb + "</div></section>";

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
      Repo.saveNodeSession({ studentId: getSid(), nodeId: node.id, currentStage: 1, unlockedStage: 1, hintLevelIndex: 0, remedialPassed: false, lastFeedback: "已重新開始此知識點，歡迎先回顧教材重點。", lastFeedbackType: "ok", logs: [] });
      renderTeachingEngine(container, node.id);
    });
  }

  window.TeachingEngineModule = { render: renderTeachingEngine, repository: Repo, evaluateFiveDimensions: evaluateFiveDimensions, semanticHook: SemanticHook, experimentalParams: EXPERIMENTAL_PARAMS };
})();

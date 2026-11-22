/* 第二階段：學生端教學引擎（獨立模組，不修改既有教材與後端結構） */
(function () {
  "use strict";

  // 1. 可調整實驗門檻（非教育研究驗證定論，僅供測試調整）
  var EXPERIMENTAL_THRESHOLDS = {
    masteryMinAccuracy: 0.75,      // 達「精熟」最低正確率實驗門檻
    progressMinAccuracy: 0.45,     // 達「穩定進步」最低正確率實驗門檻
    maxHintsForMastery: 2          // 單次作答使用提示層級超過此數值時，傾向「穩定進步」或「需要加強」
  };

  // 2. 既有 M1-01、M1-02 教材與六階段設定（完整保留原有內容）
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
      // 階段 2：自然提及相關觀念，但不直接重貼階段 1 教材全文
      stage2Guide: {
        questionId: "M1-01-S2-GUIDE",
        dimension: "推理能力",
        prompt:
          "想一想：當底數是負數時，次方次數是奇數或偶數，結果的正負號有什麼不同？試著用你自己的話說明為什麼 (-2)^3 是負數，但 (-2)^4 是正數。",
        expectedAnswerDesc: "說明奇數次方結果為負、偶數次方結果為正（如 -8 與 +16 的乘號奇偶性）",
        validate: function (raw) {
          var s = String(raw || "").trim().toLowerCase();
          if (!s) return { ok: false, errorCode: "E06" };
          if (s.length < 3) return { ok: false, errorCode: "E05" };
          var hasSignOrParity =
            s.indexOf("奇") !== -1 ||
            s.indexOf("偶") !== -1 ||
            s.indexOf("負") !== -1 ||
            s.indexOf("正") !== -1 ||
            s.indexOf("-8") !== -1 ||
            s.indexOf("16") !== -1;
          if (!hasSignOrParity) return { ok: false, errorCode: "E01" };
          return { ok: true, errorCode: null };
        }
      },
      // 階段 3：理解檢查
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
          if (!u) return { ok: false, errorCode: "E06" };
          if (u === "B") return { ok: true, errorCode: null };
          if (u === "A") return { ok: false, errorCode: "E03" }; // 忽略括號與負號作用範圍條件
          if (u === "C") return { ok: false, errorCode: "E01" }; // 混淆次方與乘法定義
          return { ok: false, errorCode: "E05" };
        }
      },
      // 階段 4：互動練習
      stage4Practice: {
        questionId: "M1-01-S4-PRACTICE",
        dimension: "基礎運算",
        prompt: "【互動練習】請計算 2^3 + (-3)^2 的值是多少？",
        expectedAnswer: "17",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { ok: false, errorCode: "E06" };
          if (t === "17") return { ok: true, errorCode: null };
          if (t === "14" || t === "0" || t === "-1") return { ok: false, errorCode: "E02" };
          if (t === "15" || t === "12") return { ok: false, errorCode: "E07" };
          return { ok: false, errorCode: "E04" };
        }
      },
      // 階段 5：個人化補救題（不同數字、不同情境，測相同觀念）
      stage5Remedial: {
        questionId: "M1-01-S5-REMEDIAL",
        dimension: "應用能力",
        contextNote: "情境轉換：溫度變化與面積推算",
        prompt:
          "【個人化補救題】某實驗室在連續 3 小時內，每小時溫度變化倍率為 (-2)；另有一塊正方形磁磚邊長為 (-4) 公尺（以有向長度表示面積計算）。請問 (-2)^3 + (-4)^2 的數值是多少？",
        expectedAnswer: "8",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { ok: false, errorCode: "E06" };
          if (t === "8") return { ok: true, errorCode: null };
          if (t === "-24") return { ok: false, errorCode: "E02" };
          return { ok: false, errorCode: "E04" };
        }
      },
      hints: {
        H1: "先回想次方代表「連續相乘的次數」，並留意括號有沒有把負號一起包住。",
        H2: "你可以先拆成個別項目的正負號與連乘算式，再把結果合起來看。",
        H3: "以 2^3 + (-3)^2 為例：先算 2×2×2 = 8，再算 (-3)×(-3) = 9，最後將兩數相加。",
        H4: "完整解析：2^3 = 8，(-3)^2 = (-3)×(-3) = 9，8 + 9 = 17。關鍵在於看清楚次方作用在誰身上。"
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
          "想一想：如果同底數相除時指數相減，例如 5^2 ÷ 5^2 會得到 5^0；從除法規律來看，為什麼非零數的 0 次方會規定為 1，而不是 0？",
        expectedAnswerDesc: "用同底數相除或相同數相除等於 1 來說明為何 a^0 = 1（且 a ≠ 0）",
        validate: function (raw) {
          var s = String(raw || "").trim().toLowerCase();
          if (!s) return { ok: false, errorCode: "E06" };
          if (s.length < 2) return { ok: false, errorCode: "E05" };
          var hasLogic =
            s.indexOf("除") !== -1 ||
            s.indexOf("自己") !== -1 ||
            s.indexOf("1") !== -1 ||
            s.indexOf("相減") !== -1 ||
            s.indexOf("規律") !== -1;
          if (!hasLogic) return { ok: false, errorCode: "E01" };
          return { ok: true, errorCode: null };
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
          if (!u) return { ok: false, errorCode: "E06" };
          if (u === "B") return { ok: true, errorCode: null };
          if (u === "A") return { ok: false, errorCode: "E03" }; // 忽略底數不可為 0 的適用條件
          if (u === "C") return { ok: false, errorCode: "E07" }; // 條件判斷方向偏差
          return { ok: false, errorCode: "E01" };
        }
      },
      stage4Practice: {
        questionId: "M1-02-S4-PRACTICE",
        dimension: "基礎運算",
        prompt: "【互動練習】請計算 (-6)^0 + 2^3 - 5^0 的值是多少？",
        expectedAnswer: "8",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { ok: false, errorCode: "E06" };
          if (t === "8") return { ok: true, errorCode: null };
          if (t === "7" || t === "2") return { ok: false, errorCode: "E01" };
          if (t === "9") return { ok: false, errorCode: "E07" };
          return { ok: false, errorCode: "E04" };
        }
      },
      stage5Remedial: {
        questionId: "M1-02-S5-REMEDIAL",
        dimension: "應用能力",
        contextNote: "情境轉換：密碼設定與變數條件",
        prompt:
          "【個人化補救題】某系統設定規則：當變數 k 滿足 (k + 4)^0 = 1 時，可啟用 1 組備援節點（值為 1），另有 2 組各為 3^1 的主節點。請問總節點數（1 + 3^1 + 3^1）是多少？（請同時留意 k 需滿足 k ≠ -4）",
        expectedAnswer: "7",
        validate: function (raw) {
          var t = String(raw || "").trim();
          if (!t) return { ok: false, errorCode: "E06" };
          if (t === "7") return { ok: true, errorCode: null };
          if (t === "6" || t === "5") return { ok: false, errorCode: "E01" };
          return { ok: false, errorCode: "E04" };
        }
      },
      hints: {
        H1: "先提醒自己：底數不為 0 時，零次方的結果是 1，而不是 0；同時底數本身不能為 0。",
        H2: "把算式拆成每一項分別算出來，再依加減順序合併，別急著心算整串。",
        H3: "以 (-6)^0 + 2^3 - 5^0 為例：(-6)^0 = 1，2^3 = 8，5^0 = 1，先算 1 + 8 再減 1。",
        H4: "完整解析：1 + 8 - 1 = 8。零指數的核心是「非零底數的零次方為 1，且底數不能為 0」。"
      }
    }
  };

  // 3. 內部錯誤診斷回饋（不向學生暴露 E01-E07 代碼）
  function buildStudentFriendlyFeedback(errorCode, hintLevel, node, answerText) {
    var friendlyMap = {
      E01: "你似乎對這個概念的定義還有些模糊，我們先放慢腳步，從概念的核心意思重新想一想。",
      E02: "這一步的性質或規則運用好像有點卡住，先看看題目中底數與次方的關係。",
      E03: "差一點就對了！你似乎忽略了這條規則的適用條件，先檢查一下底數或括號的限制。",
      E04: "計算過程可能出現小偏差，我們把算式拆開一步一步算，不急著一次算完。",
      E05: "你的想法很有起點，不過推論過程還少了一點連結，試著把理由說得更完整。",
      E06: "看起來作答內容還不夠完整，試著寫出你的想法或算式，我們一起往下推。",
      E07: "可能是看題或抄寫時不小心疏忽了，先深呼吸確認一下數字與符號。"
    };

    var baseMsg = friendlyMap[errorCode] || "這題先別急，我們一起換個角度拆解看看。";
    var hintText = node.hints[hintLevel] || node.hints.H1;

    return (
      baseMsg +
      "\n（你剛剛輸入：「" +
      answerText +
      "」）\n" +
      "【" +
      hintLevel +
      " 引導】" +
      hintText
    );
  }

  // 4. 學習紀錄儲存層（與教學邏輯分離，方便第三階段接入帳號與雲端）
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
        // 忽略本機儲存配額例外
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

  // 5. 動態精熟度計算器（依實際作答紀錄，不使用虛構分數或固定精熟度）
  function evaluateMasteryFromLogs(logs) {
    var list = Array.isArray(logs) ? logs : [];
    var total = list.length;
    var correctCount = list.filter(function (item) {
      return Boolean(item.isCorrect);
    }).length;
    var accuracy = total > 0 ? correctCount / total : 0;

    var maxHintUsed = 0;
    var remedialAttempted = false;
    var remedialSuccess = false;
    var dimensions = {
      概念理解: "尚未作答",
      基礎運算: "尚未作答",
      推理能力: "尚未作答",
      應用能力: "尚未作答",
      獨立完成程度: "尚未作答"
    };

    var dimStats = {};
    list.forEach(function (item) {
      var hNum = item.hintLevel ? parseInt(String(item.hintLevel).replace("H", ""), 10) || 0 : 0;
      if (hNum > maxHintUsed) maxHintUsed = hNum;
      if (item.isRemedial) {
        remedialAttempted = true;
        if (item.isCorrect) remedialSuccess = true;
      }
      if (item.dimension) {
        if (!dimStats[item.dimension]) dimStats[item.dimension] = { ok: 0, all: 0 };
        dimStats[item.dimension].all += 1;
        if (item.isCorrect) dimStats[item.dimension].ok += 1;
      }
    });

    Object.keys(dimStats).forEach(function (dimKey) {
      var st = dimStats[dimKey];
      dimensions[dimKey] = st.ok + "/" + st.all + " 次正確";
    });

    if (total === 0) {
      dimensions["獨立完成程度"] = "尚無紀錄";
      return {
        statusLabel: "需要加強",
        summaryNote: "尚無實際作答紀錄，建議從第一階段教材與引導題開始累積。",
        accuracyText: "0%（0/0）",
        dimensions: dimensions,
        thresholds: EXPERIMENTAL_THRESHOLDS
      };
    }

    var independentLabel =
      maxHintUsed === 0
        ? "未依賴提示作答"
        : maxHintUsed <= EXPERIMENTAL_THRESHOLDS.maxHintsForMastery
          ? "曾使用輕量提示（最高 H" + maxHintUsed + "）"
          : "曾使用較多提示（最高 H" + maxHintUsed + "）";
    if (remedialAttempted) {
      independentLabel += remedialSuccess ? "・補救題已通過" : "・補救題待通過";
    }
    dimensions["獨立完成程度"] = independentLabel;

    var statusLabel = "需要加強";
    if (
      accuracy >= EXPERIMENTAL_THRESHOLDS.masteryMinAccuracy &&
      maxHintUsed <= EXPERIMENTAL_THRESHOLDS.maxHintsForMastery &&
      (!remedialAttempted || remedialSuccess)
    ) {
      statusLabel = "精熟";
    } else if (accuracy >= EXPERIMENTAL_THRESHOLDS.progressMinAccuracy) {
      statusLabel = "穩定進步";
    }

    return {
      statusLabel: statusLabel,
      summaryNote:
        "依目前 " +
        total +
        " 筆實際作答計算（實驗參數門檻：精熟≥" +
        Math.round(EXPERIMENTAL_THRESHOLDS.masteryMinAccuracy * 100) +
        "%、穩定進步≥" +
        Math.round(EXPERIMENTAL_THRESHOLDS.progressMinAccuracy * 100) +
        "%）。",
      accuracyText: Math.round(accuracy * 100) + "%（" + correctCount + "/" + total + "）",
      dimensions: dimensions,
      thresholds: EXPERIMENTAL_THRESHOLDS
    };
  }

  // 6. 教學引擎核心狀態與推進邏輯
  var engineState = {
    selectedNodeId: "M1-01",
    answerDraft: ""
  };

  function getCurrentStudentId() {
    var nameEl = document.getElementById("stuInp");
    var fromDom = nameEl && nameEl.value ? nameEl.value.trim() : "";
    var fromStore = (localStorage.getItem("edu_stu") || "").trim();
    return fromDom || fromStore || "訪客學員";
  }

  function getNextHintLevel(session) {
    var order = ["H1", "H2", "H3", "H4"];
    var idx = Math.min(session.hintLevelIndex || 0, order.length - 1);
    session.hintLevelIndex = Math.min((session.hintLevelIndex || 0) + 1, order.length - 1);
    return order[idx];
  }

  function advanceToStage2(studentId, nodeId) {
    var session = TeachingRecordRepository.getNodeSession(studentId, nodeId);
    // 進入引導問題後，鎖定階段 1 不可返回教材
    session.unlockedStage = Math.max(session.unlockedStage, 2);
    session.currentStage = 2;
    session.lastFeedback = "已進入「引導問題」。本階段起不再返回階段 1 教材，請依提示思考後作答。";
    session.lastFeedbackType = "ok";
    TeachingRecordRepository.saveNodeSession(session);
  }

  function handleStageSubmit(studentId, nodeId, userAnswer) {
    var node = KNOWLEDGE_NODES[nodeId];
    var session = TeachingRecordRepository.getNodeSession(studentId, nodeId);
    var stage = session.currentStage;

    var activeSpec = null;
    var isRemedial = false;
    if (stage === 2) activeSpec = node.stage2Guide;
    else if (stage === 3) activeSpec = node.stage3Check;
    else if (stage === 4) activeSpec = node.stage4Practice;
    else if (stage === 5) {
      activeSpec = node.stage5Remedial;
      isRemedial = true;
    }

    if (!activeSpec) return;

    var checkResult = activeSpec.validate(userAnswer);
    var hintUsedNow = null;

    if (!checkResult.ok) {
      hintUsedNow = getNextHintLevel(session);
    }

    var logEntry = {
      knowledgeNode: node.code,
      questionId: activeSpec.questionId,
      dimension: activeSpec.dimension,
      studentAnswer: userAnswer,
      expectedAnswer: activeSpec.expectedAnswer || activeSpec.expectedAnswerDesc || "",
      isCorrect: checkResult.ok,
      errorCode: checkResult.ok ? null : checkResult.errorCode,
      hintLevel: hintUsedNow,
      completedAt: new Date().toISOString(),
      isRemedial: isRemedial,
      remedialPassed: isRemedial ? checkResult.ok : false
    };

    session = TeachingRecordRepository.appendAnswerLog(studentId, nodeId, logEntry);

    if (checkResult.ok) {
      session.hintLevelIndex = 0;
      if (stage === 2) {
        session.currentStage = 3;
        session.unlockedStage = Math.max(session.unlockedStage, 3);
        session.lastFeedback = "觀念引導很有想法！現在進入「理解檢查」，確認你對條件與算式的掌握。";
        session.lastFeedbackType = "ok";
      } else if (stage === 3) {
        session.currentStage = 4;
        session.unlockedStage = Math.max(session.unlockedStage, 4);
        session.lastFeedback = "理解檢查通過！接著進入「互動練習」，實際動手算算看。";
        session.lastFeedbackType = "ok";
      } else if (stage === 4) {
        // 階段 4 完成後，進入階段 5 個人化補救（以不同情境測相同觀念）
        session.currentStage = 5;
        session.unlockedStage = Math.max(session.unlockedStage, 5);
        session.lastFeedback =
          "互動練習完成！接下來進入「個人化補救」，我們換一個不同情境的題目，檢驗你是否真正掌握這個觀念。";
        session.lastFeedbackType = "ok";
      } else if (stage === 5) {
        session.remedialPassed = true;
        session.currentStage = 6;
        session.unlockedStage = Math.max(session.unlockedStage, 6);
        session.lastFeedback = "補救題也順利完成！現在進入「學習總結」，查看你依據實際作答累積的學習狀態。";
        session.lastFeedbackType = "ok";
      }
      TeachingRecordRepository.saveNodeSession(session);
    } else {
      session.lastFeedback = buildStudentFriendlyFeedback(
        checkResult.errorCode,
        hintUsedNow,
        node,
        userAnswer
      );
      session.lastFeedbackType = "guide";
      TeachingRecordRepository.saveNodeSession(session);
    }
  }

  function renderStageBody(node, session, masteryEval) {
    var st = session.currentStage;
    var html = "";

    if (st === 1) {
      html +=
        "<h4 class=\"te-card-title\">階段 1：教材學習</h4>" +
        "<div class=\"te-sub-box\">" + esc(node.stage1Material) + "</div>" +
        "<div class=\"te-actions\">" +
        "<button type=\"button\" class=\"te-btn\" id=\"te-to-stage2\">完成教材，進入階段 2（引導問題）</button>" +
        "</div>";
    } else if (st === 2 || st === 3 || st === 4 || st === 5) {
      var qObj =
        st === 2
          ? node.stage2Guide
          : st === 3
            ? node.stage3Check
            : st === 4
              ? node.stage4Practice
              : node.stage5Remedial;

      var stageTitle =
        st === 2
          ? "階段 2：引導問題（已鎖定教材，不返回階段 1）"
          : st === 3
            ? "階段 3：理解檢查"
            : st === 4
              ? "階段 4：互動練習"
              : "階段 5：個人化補救（不同情境檢驗相同觀念）";

      html += "<h4 class=\"te-card-title\">" + esc(stageTitle) + "</h4>";
      if (st === 5 && qObj.contextNote) {
        html += "<div class=\"te-sub-box\">" + esc(qObj.contextNote) + "</div>";
      }
      html +=
        "<p class=\"te-text\">" + esc(qObj.prompt) + "</p>" +
        "<input type=\"text\" class=\"te-input\" id=\"te-ans-input\" placeholder=\"請輸入你的想法或答案\" />" +
        "<div class=\"te-actions\">" +
        "<button type=\"button\" class=\"te-btn\" id=\"te-submit-ans\">送出作答</button>" +
        "</div>";
    } else {
      // 階段 6：學習總結（完全依實際作答紀錄計算）
      html +=
        "<h4 class=\"te-card-title\">階段 6：學習總結（實驗參數測試模式）</h4>" +
        "<div class=\"te-sub-box\">" +
        "<strong>目前精熟度狀態：</strong>" + esc(masteryEval.statusLabel) + "\n" +
        "<strong>作答正確率：</strong>" + esc(masteryEval.accuracyText) + "\n" +
        "<strong>補救題通過狀態：</strong>" + (session.remedialPassed ? "已通過" : "尚未通過或未觸發") + "\n" +
        esc(masteryEval.summaryNote) +
        "</div>" +
        "<div class=\"te-dim-grid\">" +
        Object.keys(masteryEval.dimensions)
          .map(function (dim) {
            return (
              "<div class=\"te-dim-item\">" +
              "<div class=\"te-dim-name\">" + esc(dim) + "</div>" +
              "<div class=\"te-dim-val\">" + esc(masteryEval.dimensions[dim]) + "</div>" +
              "</div>"
            );
          })
          .join("") +
        "</div>";

      if (session.logs && session.logs.length > 0) {
        html +=
          "<div class=\"te-sub-box\"><strong>本次知識點作答紀錄明細：</strong><ul class=\"te-log-list\">" +
          session.logs
            .map(function (lg) {
              return (
                "<li>" +
                esc(lg.questionId) +
                "｜作答「" +
                esc(lg.studentAnswer) +
                "」｜" +
                (lg.isCorrect ? "正確" : "需再釐清") +
                (lg.hintLevel ? "｜提示 " + esc(lg.hintLevel) : "") +
                (lg.isRemedial ? "｜補救題" : "") +
                "</li>"
              );
            })
            .join("") +
          "</ul></div>";
      }

      html +=
        "<div class=\"te-actions\">" +
        "<button type=\"button\" class=\"te-btn secondary\" id=\"te-restart-node\">重新從階段 1 學習此知識點</button>" +
        "</div>";
    }

    return html;
  }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderTeachingEngine(container) {
    if (!container) return;
    var studentId = getCurrentStudentId();
    var node = KNOWLEDGE_NODES[engineState.selectedNodeId] || KNOWLEDGE_NODES["M1-01"];
    var session = TeachingRecordRepository.getNodeSession(studentId, 

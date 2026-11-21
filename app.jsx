const { useEffect, useState } = React;

// ==========================================
// 1. Supabase 雲端資料庫設定
// ==========================================
const SUPABASE_URL = "https://antfbdsqrznnssdvpzcn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_z7l4i49w93dZ0yrR5SPbVw_ShVGKm0J";

const isSupabaseConfigured =
  Boolean(window.supabase) &&
  !SUPABASE_URL.includes("你的專案網址") &&
  !SUPABASE_ANON_KEY.includes("你的_ANON_PUBLIC_KEY");

const db = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ==========================================
// 2. 課程架構（M0-M7 目錄 + M1-01, M1-02 完整教材）
// ==========================================
const COURSE_CATALOG = [
  { id: "M0", title: "M0 先備知識", status: "coming_soon", desc: "整數、分數、根式、次方、方程式" },
  { id: "M1-01", title: "M1-01 正整數指數", status: "ready", desc: "正整數次方的定義、直覺理解與基本運算" },
  { id: "M1-02", title: "M1-02 零指數", status: "ready", desc: "非零實數的零次方定義、推導與條件限制" },
  { id: "M2", title: "M2 指數律", status: "coming_soon", desc: "同底數相乘除、次方的次方、積的次方" },
  { id: "M3", title: "M3 指數函數", status: "coming_soon", desc: "定義、圖形與單調性質" },
  { id: "M4", title: "M4 對數基本概念", status: "coming_soon", desc: "對數定義及指數與對數轉換" },
  { id: "M5", title: "M5 對數律", status: "coming_soon", desc: "對數加減與換底公式" },
  { id: "M6", title: "M6 對數函數", status: "coming_soon", desc: "對數圖形與性質" },
  { id: "M7", title: "M7 指數與對數應用", status: "coming_soon", desc: "半衰期、複利與震級應用" },
];

const MODULE_DATA = {
  "M1-01": {
    id: "M1-01",
    title: "正整數指數",
    objectives: [
      "理解 a^n 代表 n 個 a 連續相乘，而非 a × n",
      "能正確辨識底數與指數，並計算正整數次方",
      "注意負數加括號與不加括號的運算差異",
    ],
    intuition:
      "就像細胞每次分裂成 2 個，分裂 4 次後總數是 2 × 2 × 2 × 2。數學家為了不寫一長串乘號，發明了右上角的「指數」來記錄連乘了幾次。",
    definition:
      "設 a 為任意實數，n 為正整數，則 a^n = a × a × ... × a（共 n 個 a 相乘）。其中 a 稱為底數，n 稱為指數。",
    derivation:
      "觀察規律：3^1 = 3；3^2 = 3 × 3 = 9；3^3 = 3^2 × 3 = 27；每當指數增加 1，整體數值就再乘以一次底數 3。",
    examples: [
      "2^4 = 2 × 2 × 2 × 2 = 16",
      "(-3)^2 = (-3) × (-3) = 9（括號表示連同負號一起平方）",
    ],
    counterExamples: [
      "錯誤：2^4 = 2 × 4 = 8（指數是連乘次數，不是乘法）",
      "注意：-3^2 = -(3 × 3) = -9，與 (-3)^2 = 9 不同",
    ],
    guided: {
      prompt:
        "在進入正式題目之前，想請你用自己的話或算式回答：為什麼 (-2)^3 會是負數，但 (-2)^4 卻變成正數？",
      keywords: ["奇數", "偶數", "負", "正", "-8", "16", "三個", "四個"],
      hints: {
        H1: "試著把 (-2)^3 和 (-2)^4 展開成連乘的樣子，數數看各有幾個負號。",
        H2: "兩個負號相乘會變正（負負得正），那 3 個負號與 4 個負號相乘分別會剩下什麼符號？",
        H3: "(-2)^3 = (-2)×(-2)×(-2) 有 3 個負號（奇數個）；(-2)^4 有 4 個負號（偶數個）。",
        H4: "奇數個負數相乘結果為負（-8），偶數個負數相乘結果為正（+16）。輸入「奇數個負號為負，偶數個為正」即可過關！",
      },
    },
    check: {
      prompt:
        "【觀念辨識】下列哪一個算式的值與 -5^2 相等？（請輸入選項代號 A、B 或 C）\nA. (-5)^2\nB. -(5 × 5)\nC. (-5) × 2",
      expected: "B",
      hints: {
        H1: "觀察負號有沒有被括號包起來，次方會優先作用在誰身上？",
        H2: "沒有括號時，次方只作用在數字 5 上，負號留在最前面。",
        H3: "-5^2 代表先算 5 的 2 次方，最後再加上負號，也就是 -(5 × 5)。",
        H4: "正確答案是 B，因為 -5^2 = -(5 × 5) = -25，而 A 是 +25。",
      },
    },
    practice: {
      prompt: "請計算：2^3 + (-3)^2 的值是多少？",
      expected: "17",
      hints: {
        H1: "把兩項分開計算：先算 2 的 3 次方，再算 (-3) 的 2 次方。",
        H2: "2^3 = 2×2×2 = 8；(-3)^2 是兩個 -3 相乘。",
        H3: "2^3 = 8，且 (-3)^2 = (-3)×(-3) = 9，接著把兩者相加。",
        H4: "8 + 9 = 17，正確答案是 17。",
      },
    },
    remedial: {
      explanation:
        "補救重點：計算含負號的次方時，務必先看「括號」：(1) (-a)^n 代表連同負號一起連乘 n 次；(2) -a^n 代表先算 a^n 再加負號。",
      prompt: "【補救確認題】請計算 (-2)^3 + 3^2 的值是多少？",
      expected: "1",
    },
  },
  "M1-02": {
    id: "M1-02",
    title: "零指數",
    objectives: [
      "理解為何在 a ≠ 0 時規定 a^0 = 1",
      "能分辨 0^0 無意義的必要條件限制",
      "能正確計算包含零指數的混合運算",
    ],
    intuition:
      "每次把次方減 1，就相當於除以一次底數。當 2^1 = 2 再除以 2，指數變成 0，數值剛好變成 2 ÷ 2 = 1。",
    definition:
      "當底數 a ≠ 0 時，規定 a^0 = 1。若底數 a = 0，則 0^0 在數學上「不予定義（無意義）」。",
    derivation:
      "由同底數相除指數相減：a^n ÷ a^n = a^(n-n) = a^0；另一方面，任何非零數除以自己都等於 1，因此必須規定 a^0 = 1（a ≠ 0）。",
    examples: ["99^0 = 1", "(-4)^0 = 1"],
    counterExamples: [
      "錯誤：5^0 = 0（零次方不是乘以 0）",
      "陷阱：0^0 無意義，不可寫成 1",
    ],
    guided: {
      prompt:
        "如果有一位同學說：「因為 0 乘任何數都是 0，所以 8^0 應該等於 0」，你會怎麼用除法規律向他解釋為什麼 8^0 = 1？",
      keywords: ["除", "自己", "1", "8÷8", "8/8", "規律", "減"],
      hints: {
        H1: "試著從 8^2 = 64、8^1 = 8 往下推，指數每少 1 要除以多少？",
        H2: "8^1 除以 8 就會變成 8^0，那 8 除以 8 等於多少？",
        H3: "因為 8^1 ÷ 8^1 = 8^(1-1) = 8^0，而 8 ÷ 8 = 1。",
        H4: "輸入「8除以8等於1」或說明任何非零數除以自己為 1 即可過關！",
      },
    },
    check: {
      prompt:
        "【條件判斷】若 (x - 3)^0 = 1 成立，則 x 必須滿足什麼條件？（請輸入選項代號 A、B 或 C）\nA. x 可以是任意實數\nB. x ≠ 3\nC. x > 3",
      expected: "B",
      hints: {
        H1: "回想零指數定義中的「必要條件」：底數不能等於多少？",
        H2: "因為 0^0 無意義，所以底數 (x - 3) 不能變成 0。",
        H3: "令 x - 3 ≠ 0，移項後就能得到 x 的限制條件。",
        H4: "正確答案是 B（x ≠ 3），否則底數會變成 0。",
      },
    },
    practice: {
      prompt: "請計算：(-6)^0 + 2^3 - 5^0 的值是多少？",
      expected: "8",
      hints: {
        H1: "先找出算式裡有哪幾個零次方，它們各自等於多少？",
        H2: "(-6)^0 = 1，5^0 = 1，而 2^3 = 8。",
        H3: "把算式代換成：1 + 8 - 1，再計算加減。",
        H4: "1 + 8 - 1 = 8，正確答案是 8。",
      },
    },
    remedial: {
      explanation:
        "補救重點：只要底數不是 0，無論底數是正數、負數或分數，它的 0 次方一律等於 1（例如 (-6)^0 = 1）。",
      prompt: "【補救確認題】請計算 10^0 + (-2)^0 + 3^1 的值是多少？",
      expected: "5",
    },
  },
};

const STAGE_NAMES = [
  "1. 教材學習",
  "2. 引導問題",
  "3. 理解檢查",
  "4. 互動練習",
  "5. 個人化補救",
  "6. 學習總結",
];

function diagnoseError(modId, stage, rawInput) {
  const ans = rawInput.trim().toUpperCase();
  if (!ans) return { code: "E06", name: "題意理解或作答不完整" };

  if (modId === "M1-01") {
    if (stage === 3 && ans === "A") {
      return { code: "E03", name: "忽略必要條件（忽略括號對負號的作用範圍）" };
    }
    if (stage === 4 && (ans === "14" || ans === "0" || ans === "-1")) {
      return { code: "E02", name: "性質或公式使用錯誤（次方誤算為乘法或負號處理錯誤）" };
    }
  }
  if (modId === "M1-02") {
    if (stage === 3 && ans === "A") {
      return { code: "E03", name: "忽略必要條件（忘記 0^0 無意義，底數不可為 0）" };
    }
    if (stage === 4 && (ans === "7" || ans === "8" || ans === "2")) {
      return { code: "E01", name: "定義理解錯誤（誤以為 a^0 = 0 或 (-6)^0 = -1）" };
    }
  }
  return { code: "E04", name: "運算錯誤" };
}

function getFutureDateStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function App() {
  const [role, setRole] = useState("student");
  const [studentName, setStudentName] = useState(
    () => localStorage.getItem("edu_student_name") || ""
  );
  const [classCode, setClassCode] = useState(
    () => localStorage.getItem("edu_class_code") || "MATH2026"
  );
  const [selectedModId, setSelectedModId] = useState("M1-01");

  const [stage, setStage] = useState(1);
  const [inputVal, setInputVal] = useState("");
  const [stageAttempts, setStageAttempts] = useState(0);
  const [hadErrors, setHadErrors] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showReflection, setShowReflection] = useState(false);
  const [lastErrorLogId, setLastErrorLogId] = useState(null);
  const [syncNotice, setSyncNotice] = useState("");
  const [summaryData, setSummaryData] = useState(null);

  const [logs, setLogs] = useState([]);
  const [progressList, setProgressList] = useState([]);
  const [teacherApps, setTeacherApps] = useState([]);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [loadingDash, setLoadingDash] = useState(false);

  const mod = MODULE_DATA[selectedModId];

  useEffect(() => {
    localStorage.setItem("edu_student_name", studentName);
  }, [studentName]);

  useEffect(() => {
    localStorage.setItem("edu_class_code", classCode);
  }, [classCode]);

  async function restoreStudentProgress(name, code, modId) {
    if (!db || !name.trim()) return;
    const rowId = `${code.trim() || "MATH2026"}_${name.trim()}_${modId}`;
    const { data } = await db
      .from("student_progress")
      .select("*")
      .eq("id", rowId)
      .maybeSingle();

    if (data && data.current_stage) {
      setStage(data.current_stage);
      setHadErrors(Boolean(data.need_remedial));
      if (data.current_stage === 6) {
        setSummaryData({
          mastery: data.mastery_level || "L3",
          scores: data.scores,
          day2: data.review_day2 || getFutureDateStr(2),
          day7: data.review_day7 || getFutureDateStr(7),
        });
      }
      setSyncNotice(`已從雲端恢復進度（目前位於第 ${data.current_stage} 階段）`);
    }
  }

  async function saveProgressToDb(nextStage, mastery = "L1", extra = {}) {
    if (!db || !studentName.trim()) return;
    const activeCode = classCode.trim() || "MATH2026";
    const rowId = `${activeCode}_${studentName.trim()}_${selectedModId}`;
    const payload = {
      id: rowId,
      student_name: studentName.trim(),
      class_code: activeCode,
      module_id: selectedModId,
      current_stage: nextStage,
      mastery_level: mastery,
      need_remedial: extra.needRemedial ?? hadErrors,
      scores: extra.scores || undefined,
      review_day2: extra.day2 || undefined,
      review_day7: extra.day7 || undefined,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("student_progress").upsert([payload]);
    if (error) {
      setSyncNotice("雲端同步異常：" + error.message);
    } else {
      setSyncNotice("學習進度已同步至雲端");
    }
  }

  async function insertAnswerLog({ promptText, userAns, isCorrect, errorCode, hintLevel }) {
    if (!db || !studentName.trim()) return null;
    const { data, error } = await db
      .from("answer_logs")
      .insert([
        {
          student_name: studentName.trim(),
          class_code: classCode.trim() || "MATH2026",
          module_id: selectedModId,
          stage,
          prompt_text: promptText,
          student_answer: userAns,
          is_correct: isCorrect,
          error_code: errorCode || null,
          hint_level: hintLevel || null,
        },
      ])
      .select("id")
      .single();

    if (error) {
      setSyncNotice("作答紀錄寫入失敗：" + error.message);
      return null;
    }
    return data?.id || null;
  }

  async function handleReflectionChoice(choiceText) {
    setShowReflection(false);
    if (db && lastErrorLogId) {
      await db
        .from("answer_logs")
        .update({ self_reflection: choiceText })
        .eq("id", lastErrorLogId);
    }
    if (choiceText.includes("觀念")) {
      setHadErrors(true);
    }
  }

  function advanceToStage(targetStage) {
    setStage(targetStage);
    setInputVal("");
    setStageAttempts(0);
    setFeedback(null);
    setShowReflection(false);
  }

  async function handleCompleteStage1() {
    if (!studentName.trim()) {
      setFeedback({ type: "error", text: "請先輸入你的姓名，系統才能記錄你的學習進度。" });
      return;
    }
    advanceToStage(2);
    await saveProgressToDb(2, "L1");
  }

  async function handleStageSubmit(e) {
    e.preventDefault();
    if (!studentName.trim()) {
      setFeedback({ type: "error", text: "請先填寫姓名。" });
      return;
    }
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const nextAttempt = stageAttempts + 1;
    setStageAttempts(nextAttempt);
    const hintKeys = ["H1", "H2", "H3", "H4"];

    if (stage === 2) {
      const passed = mod.guided.keywords.some((kw) =>
        trimmed.toLowerCase().includes(kw.toLowerCase())
      );
      if (passed) {
        await insertAnswerLog({
          promptText: mod.guided.prompt,
          userAns: trimmed,
          isCorrect: true,
        });
        advanceToStage(3);
        await saveProgressToDb(3, "L2");
        setFeedback({ type: "success", text: "觀念引導過關！進入階段三：理解檢查。" });
      } else {
        setHadErrors(true);
        const hLevel = hintKeys[Math.min(nextAttempt - 1, 3)];
        await insertAnswerLog({
          promptText: mod.guided.prompt,
          userAns: trimmed,
          isCorrect: false,
          errorCode: "E01",
          hintLevel: hLevel,
        });
        setFeedback({
          type: "hint",
          text: `[${hLevel} 引導提示] ${mod.guided.hints[hLevel]}`,
        });
      }
      return;
    }

    if (stage === 3) {
      const isCorrect = trimmed.toUpperCase() === mod.check.expected;
      if (isCorrect) {
        await insertAnswerLog({
          promptText: mod.check.prompt,
          userAns: trimmed,
          isCorrect: true,
        });
        advanceToStage(4);
        await saveProgressToDb(4, "L2");
        setFeedback({ type: "success", text: "理解檢查通過！進入階段四：互動練習。" });
      } else {
        setHadErrors(true);
        const diag = diagnoseError(selectedModId, 3, trimmed);
        const hLevel = hintKeys[Math.min(nextAttempt - 1, 3)];
        const logId = await insertAnswerLog({
          promptText: mod.check.prompt,
          userAns: trimmed,
          isCorrect: false,
          errorCode: diag.code,
          hintLevel: hLevel,
        });
        setLastErrorLogId(logId);
        setShowReflection(true);
        setFeedback({
          type: "hint",
          text: `[${hLevel} 提示] ${mod.check.hints[hLevel]}`,
        });
      }
      return;
    }

    if (stage === 4) {
      const isCorrect = trimmed === mod.practice.expected;
      if (isCorrect) {
        await insertAnswerLog({
          promptText: mod.practice.prompt,
          userAns: trimmed,
          isCorrect: true,
        });
        if (hadErrors || nextAttempt > 1) {
          advanceToStage(5);
          await saveProgressToDb(5, "L3", { needRemedial: true });
          setFeedback({
            type: "info",
            text: "已解出練習題！因為剛才過程中有出現迷思，系統為你安排了階段五「個人化補救確認」。",
          });
        } else {
          await finalizeModule("L4");
        }
      } else {
        setHadErrors(true);
        const diag = diagnoseError(selectedModId, 4, trimmed);
        const hLevel = hintKeys[Math.min(nextAttempt - 1, 3)];
        const logId = await insertAnswerLog({
          promptText: mod.practice.prompt,
          userAns: trimmed,
          isCorrect: false,
          errorCode: diag.code,
          hintLevel: hLevel,
        });
        setLastErrorLogId(logId);
        setShowReflection(true);
        setFeedback({
          type: "hint",
          text: `[${hLevel} 提示] ${mod.practice.hints[hLevel]}`,
        });
      }
      return;
    }

    if (stage === 5) {
      const isCorrect = trimmed === mod.remedial.expected;
      if (isCorrect) {
        await insertAnswerLog({
          promptText: mod.remedial.prompt,
          userAns: trimmed,
          isCorrect: true,
        });
        await finalizeModule("L3");
      } else {
        await insertAnswerLog({
          promptText: mod.remedial.prompt,
          userAns: trimmed,
          isCorrect: false,
          errorCode: "E04",
          hintLevel: "H3",
        });
        setFeedback({
          type: "hint",
          text: "再仔細檢查一次正負號與零指數的值，重新算算看！",
        });
      }
    }
  }

  async function finalizeModule(masteryLevel) {
    const scores = hadErrors
      ? { concept: 75, calc: 80, logic: 75, transfer: 70, indep: 75 }
      : { concept: 95, calc: 90, logic: 90, transfer: 85, indep: 95 };
    const day2 = getFutureDateStr(2);
    const day7 = getFutureDateStr(7);
    setSummaryData({ mastery: masteryLevel, scores, day2, day7 });
    advanceToStage(6);
    await saveProgressToDb(6, masteryLevel, {
      needRemedial: false,
      scores,
      day2,
      day7,
    });
  }

  async function loadDashboardData() {
    if (!db) return;
    setLoadingDash(true);
    const activeCode = classCode.trim() || "MATH2026";
    const [{ data: lData }, { data: pData }, { data: tData }] = await Promise.all([
      db
        .from("answer_logs")
        .select("*")
        .eq("class_code", activeCode)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("student_progress")
        .select("*")
        .eq("class_code", activeCode)
        .order("updated_at", { ascending: false }),
      db
        .from("teacher_applications")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    setLogs(lData || []);
    setProgressList(pData || []);
    setTeacherApps(tData || []);
    setLoadingDash(false);
  }

  useEffect(() => {
    if (role === "teacher" || role === "admin") {
      loadDashboardData();
    }
  }, [role, classCode]);

  async function handleTeacherApply(e) {
    e.preventDefault();
    if (!db || !newTeacherName.trim()) return;
    await db
      .from("teacher_applications")
      .insert([{ teacher_name: newTeacherName.trim(), status: "pending" }]);
    setNewTeacherName("");
    loadDashboardData();
  }

  async function handleApproveTeacher(id, status) {
    if (!db) return;
    await db.from("teacher_applications").update({ status }).eq("id", id);
    await db.from("audit_logs").insert([
      { action: `TEACHER_${status.toUpperCase()}`, target_info: `application_id=${id}` },
    ]);
    loadDashboardData();
  }

  async function handleAdminResetProgress(row) {
    if (!db) return;
    await db
      .from("student_progress")
      .update({ current_stage: 1, mastery_level: "L1", need_remedial: false })
      .eq("id", row.id);
    await db.from("audit_logs").insert([
      {
        action: "RESET_STUDENT_PROGRESS",
        target_info: `${row.student_name} (${row.module_id})`,
      },
    ]);
    loadDashboardData();
  }

  function handleSelectModule(modId) {
    if (!MODULE_DATA[modId]) return;
    setSelectedModId(modId);
    setStage(1);
    setInputVal("");
    setStageAttempts(0);
    setHadErrors(false);
    setFeedback(null);
    setSummaryData(null);
    if (studentName.trim()) {
      restoreStudentProgress(studentName, classCode, modId);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9F5] text-slate-800 pb-14">
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-950">AI 個人化教育平台</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-medium">
              規則式教學測試模式
            </span>
          </div>
          <div className="flex gap-1 bg-emerald-50 p-1 rounded-xl text-xs sm:text-sm">
            {[
              { id: "student", label: "學生學習" },
              { id: "teacher", label: "教師班級" },
              { id: "admin", label: "平台管理" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRole(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  role === tab.id
                    ? "bg-emerald-800 text-white"
                    : "text-emerald-900 hover:bg-emerald-100/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-5 space-y-5">
        {!isSupabaseConfigured && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-2xl text-xs sm:text-sm">
            <strong>尚未連接 Supabase 雲端資料庫：</strong>請檢查設定或網路連線。
          </div>
        )}

        <section className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {role === "student" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  學生姓名（必填）
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  onBlur={() => restoreStudentProgress(studentName, classCode, selectedModId)}
                  placeholder="輸入姓名（如：陳小華）"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emeral

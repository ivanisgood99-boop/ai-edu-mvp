"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadApplication() {
  const values = new Map();
  const window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {}
  };
  const document = {
    addEventListener() {},
    removeEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    window,
    document,
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options && options.detail; }
    },
    console,
    Date,
    Promise,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error
  };
  vm.createContext(sandbox);
  for (const file of ["curriculum-data.js", "teaching-engine.js", "student-home.js"]) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  }
  return sandbox.window;
}

test("student learning map uses exactly the levels exposed by the teaching engine", () => {
  const app = loadApplication();
  const chapters = app.StudentHomeModule.getChapters();
  const engine = app.TeachingEngineModule;

  assert.equal(chapters.length, Object.keys(engine.chapters).length);
  for (const chapter of chapters) {
    const engineChapter = engine.chapters[chapter.chapterId];
    const expected = Array.from(engine.levels)
      .filter((level) => level.chapterId === chapter.chapterId)
      .sort((a, b) => a.levelNumber - b.levelNumber)
      .map((level) => level.levelId);
    assert.equal(chapter.title, engineChapter.title);
    assert.deepEqual(Array.from(chapter.levels, (level) => level.levelId), expected);
  }
});

test("server-saved X-1 progress unlocks X-2 after signing in on another device", () => {
  const app = loadApplication();
  const engine = app.TeachingEngineModule;
  engine.setStudentContext("student-a", [
    {
      level_id: "CH2-L1",
      stage_x1_completed: true,
      stage_x2_completed: false,
      level_completed: false,
      star_rating: "TWO_STARS",
      mastery_level: "★★☆ 穩定進步"
    }
  ]);

  assert.equal(engine.getStrictStageAccess("student-a", "CH2-L1", "X-2").allowed, true);
  assert.equal(engine.getStrictStageAccess("student-a", "CH2-L1", "X-2").completed, false);
});

test("server progress from one account never unlocks another account's level", () => {
  const app = loadApplication();
  const engine = app.TeachingEngineModule;
  engine.setStudentContext("student-a", [
    { level_id: "CH2-L1", stage_x1_completed: true, stage_x2_completed: true, level_completed: true }
  ]);

  assert.equal(engine.getStrictStageAccess("student-a", "CH2-L1", "X-2").completed, true);
  assert.equal(engine.getStrictStageAccess("student-b", "CH2-L1", "X-2").allowed, false);

  engine.setStudentContext(null, []);
  assert.equal(engine.getStrictStageAccess("student-a", "CH2-L1", "X-2").allowed, false);
});


function loadLearningStats(rpcRow) {
  let statisticsReads = 0;
  const window = {
    TeachingEngineModule: {
      async flushLearningSync() { return { ok: true }; }
    },
    sbClient: {
      async rpc() { return { data: rpcRow, error: null }; },
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          async order() {
            statisticsReads += 1;
            return { data: [], error: null };
          }
        };
      }
    }
  };
  const sandbox = { window, console, Promise, String, Boolean, Number, Object, Array };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(process.cwd(), "learning-stats-and-resources.js"), "utf8");
  vm.runInContext(source, sandbox, { filename: "learning-stats-and-resources.js" });
  return { module: window.LearningStatsAndResourcesModule, getStatisticsReads: () => statisticsReads };
}

test("summary RPC cannot report success until the server confirms level_completed", async () => {
  const app = loadLearningStats({ level_completed: false, stage_x1_completed: true, stage_x2_completed: false });
  const result = await app.module.commitLearningSummary({
    levelId: "CH2-L1",
    chapterId: "CH-2",
    studentId: "student-a"
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /伺服器尚未確認本 Level 完成/);
  assert.equal(app.getStatisticsReads(), 0);
});

test("summary RPC reports success only for server-confirmed completed levels", async () => {
  const app = loadLearningStats({ level_completed: true, stage_x1_completed: true, stage_x2_completed: true });
  const result = await app.module.commitLearningSummary({
    levelId: "CH2-L1",
    chapterId: "CH-2",
    studentId: "student-a"
  });

  assert.equal(result.ok, true);
  assert.equal(result.updatedRow.level_completed, true);
  assert.equal(app.getStatisticsReads(), 1);
});


function loadSyncEngine(storage, rpcHandler) {
  const calls = [];
  const window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    AuthSystemModule: {
      async getCurrentSession() { return { user: { id: "student-a" } }; }
    },
    sbClient: {
      async rpc(name, args) {
        calls.push({ name, args });
        return rpcHandler(name, args);
      }
    }
  };
  const sandbox = {
    window,
    document: {
      addEventListener() {},
      removeEventListener() {},
      getElementById() { return null; },
      querySelectorAll() { return []; }
    },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options && options.detail; }
    },
    console,
    Date,
    Promise,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Uint8Array
  };
  vm.createContext(sandbox);
  for (const file of ["curriculum-data.js", "teaching-engine.js"]) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  }
  return { app: window.TeachingEngineModule, calls };
}

test("failed answer sync survives reload and retries with the same idempotency key", async () => {
  const storage = new Map();
  const first = loadSyncEngine(storage, async () => ({ data: null, error: { message: "temporary network failure" } }));
  first.app.setStudentContext("student-a", []);
  first.app.repository.appendLog("student-a", "CH2-L1", {
    chapterId: "CH-2",
    levelId: "CH2-L1",
    questionId: "CH2-L1-P1",
    stageType: "practice",
    studentAnswer: "這是一段足夠完整的數學推理說明",
    isCorrect: false,
    verdict: "submitted",
    isRemedial: false
  });

  const firstFlush = await first.app.flushLearningSync("CH2-L1");
  assert.equal(firstFlush.ok, false);
  assert.equal(first.calls.length, 1);
  assert.equal(first.calls[0].name, "record_learning_answer_idempotent");
  const firstSubmissionId = first.calls[0].args.p_client_submission_id;
  assert.match(firstSubmissionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  const second = loadSyncEngine(storage, async () => ({ data: { ok: true, duplicate: false }, error: null }));
  second.app.setStudentContext("student-a", []);
  const secondFlush = await second.app.flushLearningSync("CH2-L1");

  assert.equal(secondFlush.ok, true);
  assert.equal(second.calls.length, 1);
  assert.equal(second.calls[0].args.p_client_submission_id, firstSubmissionId);
  assert.deepEqual(JSON.parse(storage.get("ai_edu_answer_outbox_v1:student-a")), []);
});

test("answer outbox is isolated by authenticated student UID", () => {
  const storage = new Map();
  const app = loadSyncEngine(storage, async () => ({ data: { ok: true }, error: null }));
  app.app.setStudentContext("student-a", []);
  app.app.repository.appendLog("student-a", "CH2-L1", {
    chapterId: "CH-2",
    levelId: "CH2-L1",
    questionId: "CH2-L1-G",
    stageType: "guide",
    studentAnswer: "這是一段足夠完整的數學推理說明",
    isCorrect: false,
    verdict: "submitted",
    isRemedial: false
  });

  const outboxA = JSON.parse(storage.get("ai_edu_answer_outbox_v1:student-a"));
  assert.equal(outboxA.length, 1);
  assert.equal(storage.has("ai_edu_answer_outbox_v1:student-b"), false);
});


test("idempotent answer migration defines a separate secured RPC and unique per-student key", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261128130000_idempotent_learning_answer_submissions.sql"),
    "utf8"
  );
  assert.ok(migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS learning_answer_logs_student_submission_uidx"));
  assert.ok(migration.includes("FUNCTION public.record_learning_answer_idempotent("));
  assert.ok(migration.includes("pg_advisory_xact_lock"));
  assert.ok(migration.includes("client_submission_id = p_client_submission_id"));
  assert.ok(migration.includes("v_result := public.record_learning_answer("));
  assert.ok(migration.includes("role = 'student' AND p.account_status = 'active'"));
  assert.ok(migration.includes("REVOKE ALL ON FUNCTION public.record_learning_answer_idempotent"));
});


test("student context starts outbox recovery before statistics refresh can fail", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "student-home.js"), "utf8");
  const contextIndex = source.indexOf('setStudentContext(st.user.id, []);');
  const statisticsIndex = source.indexOf('fetchStudentStatistics(st.user.id)');
  assert.ok(contextIndex >= 0);
  assert.ok(statisticsIndex > contextIndex);
});

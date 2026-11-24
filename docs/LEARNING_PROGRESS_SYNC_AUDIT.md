# 學習紀錄與精熟度同步：檢查結果與修正規格

> 狀態：待實作／待核准資料庫變更  
> 檢查日期：2026-11-24  
> 適用分支：`codex/learning-sync-level-access`

## 1. 已確認的現況

- `teaching-engine.js` 的 `Repo.appendLog()` 目前只把作答紀錄寫入瀏覽器 `localStorage`，沒有向 Supabase `learning_answer_logs` 新增資料。
- Supabase `learning_answer_logs` 目前為 0 筆；`learning_statistics` 目前為 2 筆。
- 前端登入模組 `AuthSystemModule.getCurrentSession()` 可取得 Supabase Auth 使用者及 UUID。
- `learning_answer_logs` 欄位包含 `student_id`、`chapter_id`、`level_id`、`stage_id`、`question_id`、`raw_answer`、`ai_verdict`、`hint_count`、`is_completed` 等，可承接現有教學引擎紀錄，但需要明確的欄位映射。
- 現有 RLS 有「本人新增」與「本人／授課教師讀取」政策；沒有看到該表的 UPDATE 政策。不能假設前端可以直接更新完成旗標。
- `save_summary_and_recompute_level` 是 `SECURITY DEFINER`，擁有者為 `postgres`，設定 `search_path=public`，而且目前 ACL 顯示 `PUBLIC` 具有 EXECUTE。函式內有 `auth.uid()` 非空檢查，但仍應收緊執行權限並完成安全檢查。

## 2. 已發現的資料一致性問題

### 2.1 作答證據未進資料庫

前端的 guide、check、practice、remedial 作答都呼叫 `Repo.appendLog()`，但這些紀錄只存在本機。資料庫 RPC 卻只查詢 `learning_answer_logs`，因此兩邊的精熟度計算依據不同。

### 2.2 X-1 完成狀態沒有可靠地持久化

目前總結同步只以 `stage_id = X-2` 呼叫 RPC。RPC 只會在該次呼叫中，依 `p_stage_id` 暫時判定該階段完成；它不會把另一階段的完成狀態永久保存到作答列。若只先呼叫 X-1、再呼叫 X-2，第二次重算仍可能失去第一次的 X-1 完成狀態。

### 2.3 星級算法兩端不一致

前端星級算法以不同題目數作為題數證據，並使用補救題通過狀態；資料庫 RPC 目前直接計算所有作答列，沒有按 `question_id` 去重，也沒有等價的補救通過條件。若把每次重試都寫入資料庫，資料庫正確率可能與前端不同。

## 3. 建議的修正順序

1. **先定義單一資料契約**：guide/check 對應 X-1；practice/remedial 對應 X-2。每筆紀錄使用 Auth 的 `auth.uid()` 作為 `student_id`，不可使用畫面輸入的學生名稱或 localStorage 學生代號作為資料庫身分。
2. **保存每次作答**：記錄題目 ID、原始答案、判定結果、提示數、子概念與階段。保留重試紀錄，但需有 `attempt_no` 或 `is_first_attempt`，讓精熟度算法可明確取首次作答，不以重試次數扭曲題目正確率。
3. **持久化階段完成**：由經過身分驗證的資料庫函式負責寫入階段完成狀態；不能只依賴前端的 `p_mark_stage_completed` 布林值，也不能依賴呼叫順序暫存完成狀態。
4. **統一精熟度算法**：資料庫與前端使用相同的題目去重、首次作答、提示依賴、補救通過及星級門檻。建議以資料庫結果為正式紀錄，前端僅呈現結果。
5. **收緊 RPC 權限**：檢查函式的 `SECURITY DEFINER` 必要性、固定安全的 search_path、保留 `auth.uid()` 所有權驗證，並撤銷不必要的 PUBLIC／anon EXECUTE，只授權必要角色。
6. **驗證後再部署**：先在測試帳號驗證 X-1、X-2、重試、重新登入、跨裝置讀取及教師讀取；確認無誤才套用正式資料庫遷移。

## 4. 驗收測試

- 未登入時作答：只允許本機暫存，不得冒用其他學生身分寫入資料庫。
- 登入後完成 guide 與 check：資料庫只記錄該登入者的作答，X-1 完成狀態可在重新登入後保留。
- X-1 完成後進入同一 Level 的 X-2：允許；其他 Level 不應被不必要地鎖定。
- 同一題答錯後重試答對：兩次作答都可追蹤，但星級題數與正確率依規格計算，不因重試重複灌水。
- 完成 X-2：重新登入後仍保留 X-1、X-2 完成狀態，且星級與前端顯示一致。
- 以另一個學生帳號呼叫 RPC：不得讀寫第一位學生的紀錄。
- anon 角色不得呼叫具權限的精熟度更新 RPC。

## 5. 變更界線

本次檢查沒有修改 Supabase 資料表、RLS、函式或正式資料。以上資料庫修正需要先審查並核准遷移內容；在核准前，不應直接寫入正式資料庫。  


## 6. 已執行的資料庫變更（2026-11-24）

已在 Supabase 專案套用兩個 migration：

- `20261124124026_learning_answer_persistence_and_progress_v1`
- `20261124124114_secure_learning_answer_rpc_writes`

變更內容：
- 建立 `private.learning_level_requirements`，目前登錄 10 個 Level 的 guide、check、practice 題目 ID。
- `learning_answer_logs` 新增 `question_type`、`attempt_no`、`is_first_attempt`。
- 新增 `record_learning_answer` RPC：以 `auth.uid()` 綁定學生身分、限制題目 ID、由資料庫計算嘗試次數，並觸發統計重算。
- 撤銷瀏覽器直接 INSERT／UPDATE／DELETE 作答紀錄的權限；登入學生保留 SELECT，新增作答需透過 RPC。
- `save_summary_and_recompute_level` 改為從伺服器作答證據計算 X-1、X-2 與星級，不再信任前端的完成旗標。
- 兩個 RPC 都撤銷 PUBLIC／anon EXECUTE，只授權 authenticated。

## 7. 已完成的程式串接

- `teaching-engine.js`：每次作答仍先保存本機狀態，再依 Level 排隊呼叫 `record_learning_answer`；使用 Supabase Auth 目前登入者，不使用學生名稱當資料庫身分。
- `teaching-engine.js`：提供 `flushLearningSync(levelId)`，讓總結前等待該 Level 的作答同步完成。
- `learning-stats-and-resources.js`：總結重算前先 flush 作答佇列；只要有作答同步失敗，就不宣告正式精熟度更新成功。

## 8. 驗證結果與尚未完成事項

- Supabase migration 清單已顯示上述兩筆 migration。
- 資料表欄位、題目需求設定數（10 個 Level）、RPC 權限已回讀確認。
- 使用既有 profile 做過一次**交易內回滾**的 RPC 整合探測：函式成功回傳後將測試交易回滾；查詢確認沒有留下測試作答資料。
- 正式作答資料目前仍為 0 筆；尚未用真實學生登入瀏覽器完成端到端測試。
- **重要：精熟判定的 `p_is_correct` 仍由前端傳入。** 題目 ID 已白名單化，但若學生刻意改寫瀏覽器請求，仍可能偽造判定結果。下一階段必須把客觀題答案驗證移至伺服器，語意引導題則需由可信任的伺服器端 AI 評分流程回傳結果，才能把精熟度當成防篡改紀錄。
- Supabase Security Advisor 另回報 `private.learning_level_requirements` 的 RLS 尚未啟用（CRITICAL）。目前已撤銷該表對 PUBLIC／anon／authenticated 的表權限，且其所在 schema 為 private；但仍應啟用 RLS 作縱深防禦。依安全檢查要求，尚未自行套用，需先確認是否採用下列設定：
  ```sql
  ALTER TABLE private.learning_level_requirements ENABLE ROW LEVEL SECURITY;
  ```
  該表只供 postgres 擁有的受控 SECURITY DEFINER RPC 讀取；若不建立一般使用者政策，authenticated／anon 將無法直接讀取，這是預期行為。
- Advisor 仍會對「authenticated 可執行 SECURITY DEFINER」發出通用警告；目前兩個 RPC 都有 `auth.uid()` 檢查、固定 search_path、題目／Level 白名單與身分綁定。其餘既有 SECURITY DEFINER 函式的警告並非本次變更範圍。
- 尚未合併 main、未部署 GitHub Pages。

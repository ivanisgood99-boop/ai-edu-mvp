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

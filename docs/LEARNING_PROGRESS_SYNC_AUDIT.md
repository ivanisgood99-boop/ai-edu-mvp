# 學習紀錄與精熟度同步：實作與驗證紀錄

> 更新日期：2026-11-24  
> 開發分支：`codex/learning-sync-level-access`  
> 狀態：資料庫遷移已套用；前端已串接；尚待真實瀏覽器登入端到端驗收；未合併、未部署。

## 1. 這次已完成的資料庫遷移

Supabase 專案已套用以下七筆 migration：

1. `20261124124026_learning_answer_persistence_and_progress_v1`
2. `20261124124114_secure_learning_answer_rpc_writes`
3. `20261124124358_enable_rls_on_private_learning_requirements`
4. `20261124124744_server_side_answer_key_validation_v1`
5. `20261124125109_align_first_attempt_mastery_calculation`
6. `20261124125346_normalize_numeric_answers_and_configure_star_minimum`
7. `20261124125410_use_configured_mastery_threshold_and_preserve_star`

### 資料表與權限

- `private.learning_level_requirements`：10 個 Level 的章節、引導題、理解檢查題、練習題白名單及精熟門檻。
- `private.learning_answer_keys`：伺服器端答案表；18 道理解檢查題、20 道互動練習題、140 筆個人化加強題（各 Level × 7 類錯誤 × 2 題）。
- 以上 private 表均已啟用 RLS，沒有提供 anon／authenticated 直接讀取政策，並撤銷一般角色的表權限。
- `public.learning_answer_logs` 新增 `question_type`、`attempt_no`、`is_first_attempt`。
- 瀏覽器不得直接 INSERT／UPDATE／DELETE 作答紀錄；學生透過受控 RPC 新增，並依既有 RLS 政策讀取自己的紀錄。
- `learning_statistics` 對前端維持唯讀，正式更新由資料庫函式執行。

## 2. 作答紀錄與答案驗證

### `record_learning_answer`

- 學生身分只取自 `auth.uid()`，不採信畫面名稱或 localStorage 學生代號。
- 驗證 Level、章節、題型及 question ID。
- check、practice、remedial 題由 private 答案表比對原始答案；前端傳入的 `p_is_correct` 不作為客觀題判分依據。
- remedial 題另以錯誤類型（E01–E07）定位對應答案。
- 整數答案正規化會移除空白與前置正號，與前端整數驗證行為一致。
- 資料庫在交易中計算 attempt_no 與 is_first_attempt，避免前端偽造首次作答標記。
- guide 題只記錄「已提交」；目前語意回饋仍由前端 SemanticHook 提供，不能把它視為伺服器端 AI 評分。X-1 正式完成條件是 guide 已提交且該 Level 所有 check 題均由伺服器驗證正確。

### `save_summary_and_recompute_level`

- X-1：guide 提交紀錄存在，且該 Level 白名單中的所有 check 題均有伺服器判定正確紀錄。
- X-2：X-1 已完成，且至少一題白名單 practice 題或 remedial 題由伺服器判定正確。
- 星級以不同題目／題型／補救錯誤類型的首次作答計算，重試不重複增加題數。
- 前端與資料庫已對齊首次作答、正確理解檢查、正確練習、提示依賴及星級保留邏輯。
- 星級題數門檻使用 Level 設定中的 `min_star_questions`，不再寫死為 2。
- 保留原有星級的單調保護：正確率仍達 50% 時，不因單次新增錯題而降低既有星級。

## 3. 前端串接

### `teaching-engine.js`

- 每次作答先保存本機學習狀態，再依 Level 順序排隊呼叫 `record_learning_answer`。
- 使用 Supabase Auth 目前登入者；訪客模式只保留本機資料，不寫入其他人的帳號。
- 提供 `flushLearningSync(levelId)`，總結重算前等待該 Level 的同步佇列。
- 同步失敗會依題目記錄錯誤；相同題目後續同步成功會清除該題錯誤，避免舊錯誤永久阻止總結。
- remedial 作答會將錯誤類型傳到伺服器答案鍵查詢。

### `learning-stats-and-resources.js`

- 呼叫總結 RPC 前先等待作答佇列完成。
- 只要仍有作答同步錯誤，就不回報正式精熟度已更新。
- RPC 寫入成功後，統計重新讀取失敗只回報警告，不把已成功的資料庫寫入誤報為失敗。

### `student-home.js`

- 移除頁面載入時在無效作用域使用 currentLevelId/currentChapterId 的自動同步區塊，避免開頁就送出錯誤總結。

## 4. 已完成驗證

### 資料庫狀態

- Migration 清單已回讀確認七筆遷移。
- private 答案鍵數量：check 18、practice 20、remedial 140。
- `private.learning_level_requirements` 與 `private.learning_answer_keys` 均已啟用 RLS。
- anon 無法呼叫 `record_learning_answer`；authenticated 可以呼叫。
- authenticated 無法直接寫入 `learning_answer_logs`，也不能讀取 private schema。
- 正式作答紀錄仍為 0 筆；既有 learning_statistics 為 2 筆。

### 交易內回滾整合測試

使用既有 profile UUID 設定測試交易身分，在子交易中測試後主動回滾，確認沒有留下測試紀錄。測試涵蓋：

1. guide 只會存成 submitted，不採信前端正確旗標。
2. 傳入錯誤答案並把 `p_is_correct=true`，伺服器仍判定錯誤。
3. 傳入正確答案並把 `p_is_correct=false`，伺服器仍判定正確。
4. guide 提交與全部 check 正確後，X-1 正式完成。
5. X-1 完成後，正確 practice 可完成 X-2。
6. remedial 答案依錯誤類型及伺服器答案鍵驗證。
7. 帶前置正號的整數答案（例如 `+10`）可依前端規則正確判定。

最新測試呼叫未拋出例外，回滾後 `ai_reason='rollback-probe-final'` 的作答紀錄為 0 筆。

## 5. 尚未完成的驗收與風險

- 尚未使用真實學生帳號在瀏覽器完成註冊／登入／作答／刷新／重新登入／跨裝置讀取的端到端測試；目前沒有真實作答列可供驗證。
- guide 語意評分目前不是伺服器端可信 AI 評分，只作提交參與紀錄；若產品需要將語意品質計入星級，必須新增受控伺服器評分流程。
- 已新增 `.github/workflows/validate-javascript.yml`，會以 Node.js 20 對四個主要前端腳本執行 `node --check`。GitHub Actions run #4（run ID：45398321677）已完成，`JavaScript syntax` job 成功；四個主要前端腳本均通過 `node --check`。
- Security Advisor 仍會對本次兩個 authenticated 可執行的 SECURITY DEFINER RPC 發出通用警告；這兩個函式使用固定 search_path、auth.uid()、Level／題目白名單及 private RLS 表。Advisor 也列出專案內其他既有 SECURITY DEFINER 函式與其他 RLS 無政策資料表，並非本次修改範圍，需獨立稽核。
- 已建立 Draft PR #3： https://github.com/ivanisgood99-boop/ai-edu-mvp/pull/3，供檢閱與後續驗收。
- 已新增 `docs/STUDENT_E2E_TEST_PLAN.md`，列出瀏覽器端到端測試案例與測試前置條件；目前尚無本分支預覽網址，因此尚未執行真實瀏覽器驗收。
- 本次程式碼檢查發現並修正 Auth 資料讀取錯誤被靜默忽略、缺少 profile/resource 時使用預設資料，以及登出錯誤被忽略的問題；細節見端到端測試計畫。
- 本次沒有合併 main，也沒有更新 GitHub Pages 正式網站。

## 6. 上線前驗收清單

- [ ] 真實學生登入後 guide／check／practice／remedial 都能寫入本人作答紀錄。
- [ ] 重新整理頁面及重新登入後，X-1、X-2、星級可由資料庫還原。
- [ ] 離線或同步失敗時，不會誤顯示資料庫已完成；恢復連線後可重試。
- [ ] 第二個學生帳號無法讀取或修改第一個學生的作答紀錄。
- [ ] 教師端讀取班級資料仍符合既有教師 RLS 政策。
- [ ] guide 評分需求確認：維持提交型，或改成伺服器端可信 AI 評分。
- [ ] 通過以上測試後才合併及部署。

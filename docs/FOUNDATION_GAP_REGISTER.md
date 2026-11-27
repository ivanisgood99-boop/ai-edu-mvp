# 平台基礎缺口盤點（2026-11-25）

> 本文件是唯讀盤點結果與開發順序，不代表已完成修復。此次沒有修改正式資料庫、合併 PR 或更新 GitHub Pages。

## 目前確認的架構

- 前端：原生 HTML / CSS / JavaScript，部署主站仍為 GitHub Pages。
- 身分與資料：Supabase Auth、Postgres、RLS；學生端以登入者 `auth.uid()` 寫入學習作答紀錄。
- 教學主流程：Chapter → Level → Stage；X-1 為教材、引導、理解檢查；X-2 為練習、補救、總結。
- 已存在資料庫模組：班級、教師申請、學生資源、PK、抽獎、角色、造型、成就、稽核紀錄。
- 現有預覽部署仍指向舊提交 `9bcb0e4304aff6c7dc5d70175995ecd728260f89`，不是目前分支最新程式碼。

## P0：先處理資料安全

### 1. 舊版資料表存在公開全權限 RLS 政策

以下資料表目前存在套用至 `public` 或 `anon, authenticated` 的 `ALL` 政策，且 `USING (true)`、`WITH CHECK (true)`：

- `answer_logs`：34 筆紀錄，包含學生名稱、作答、正誤與反思。
- `audit_logs`：6 筆稽核紀錄。
- `student_progress`：10 筆學習進度。
- `teacher_applications`：3 筆教師申請。

這些政策等同未按使用者身分隔離資料。應先確認舊版前端是否仍使用這些表，再以遷移方式撤除公開全權限政策，為仍需使用的功能建立明確的本人／教師授權政策。不得清空或刪除既有紀錄。

### 2. SECURITY DEFINER 函式的 PUBLIC EXECUTE 權限

Supabase Security Advisor 指出下列函式可由 anon 角色呼叫：

- `apply_learning_action_reward(text, text)`
- `sync_student_stamina_and_rockets(text)`
- `use_rocket_supply()`
- `guard_profile_update()`（trigger function）
- `handle_new_user_profile()`（trigger function）

已讀取函式定義，學生資源函式有 `auth.uid()` 空值檢查；但舊版每日火箭同步 RPC 還採信呼叫端傳入的時區，可能讓登入者在日期邊界嘗試多領補給。**分支待部署 migration 已**固定使用伺服器 `Asia/Taipei`、撤銷 `sync_student_stamina_and_rockets`／`use_rocket_supply` 的 PUBLIC／anon EXECUTE，並撤銷 trigger function 的一般 API 執行權；正式資料庫尚未套用，故正式環境仍未修復。

### 3. RLS 已開啟但沒有政策的功能表

目前包含班級、班級成員、PK、抽獎、成就、角色與造型等表。沒有政策時預設拒絕一般 API 存取，這是安全的封閉狀態，但代表教師端、PK、獎勵與成就功能尚不能宣稱已完成。必須依角色及資料擁有權逐表設計政策，不可用寬鬆的全開政策解決。

## P1：核心產品功能缺口

- 學生首頁與學習地圖已有前端入口；教師班級與平台管理目前仍是說明占位畫面。
- 學習紀錄 RPC 與 private answer keys 已建立，但尚未完成真實瀏覽器帳號端到端驗收。
- 引導題目前只保存 submitted；語意判讀仍由前端規則處理，並非可信的伺服器端 AI 評分。
- 尚未完成跨裝置登入還原、兩名學生帳號隔離、教師班級授權驗證。
- PK、星際探索、抽獎、造型與成就尚未完成前後端閉環；資源必須維持學習點數、流星體力、星塵、寶石彼此獨立。

## P2：介面與教學完整度

- 目前導覽列會顯示教師與管理入口；應依資料庫 profile role 控制入口，並由資料庫政策再次授權，不能只靠隱藏按鈕保護資料。
- Chapter / Level 內容仍需逐單元補齊教材、引導問題、理解檢查、互動練習、錯誤診斷與補救題，並核對教材版本。
- 複習排程、教師儀表板、管理稽核介面與完整成就條件尚未完成。

## 建議實作順序

1. 先盤點舊版頁面與資料表依賴，建立不刪資料的安全遷移。
2. 修正公開 RPC 權限，逐表建立最小權限 RLS。
3. 完成 Auth 與學生學習紀錄瀏覽器 E2E、跨帳號隔離。
4. 完成學生首頁、星球地圖、資源帳本與六階段教學閉環。
5. 完成教師申請審核、班級建立／邀請碼／學生名單／班級學習分析。
6. 完成平台管理、PK、星際探索、抽獎、角色、造型與成就。
7. 擴充教材題庫與複習排程，完成手機與桌面響應式驗收。

## 本次檢查資料

- Supabase migration history：7 筆學習同步相關 migration。
- 學習 answer keys：178 筆；level requirements：10 筆。
- 舊版資料備份表仍存在：`backup_answer_logs_20261124` 34 筆、`backup_student_progress_20261124` 10 筆。
- 正式資料表目前仍有舊版紀錄；未執行任何刪除、清空或 schema 變更。
- Draft PR #3 保持未合併；GitHub Pages 正式網站未更新。


## 2026-11-27 追加稽核：每日資源 RPC

- 發現 `sync_student_stamina_and_rockets(p_tz)` 會用呼叫端提供的時區計算補給日期。新分支 migration 保留函式簽章以免破壞舊前端，但忽略 `p_tz`，固定以 `Asia/Taipei` 計算每日 04:00 補給日。
- 同一 migration 將體力同步與火箭補給 RPC 權限縮至 authenticated，並封鎖 trigger function 的一般 API 執行權。
- 已在交易內以 authenticated 測試身分傳入 `Pacific/Kiritimati`，確認回傳日期仍為台北伺服器日期；權限探針確認 anon 無法執行、authenticated 可執行。所有測試均 ROLLBACK。
- 正式環境未修改；正式 RPC 仍是舊定義，須在授權套用 migration 後才會生效。

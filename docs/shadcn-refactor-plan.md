# note_tool shadcn 畫面重構執行計畫

## 目標

在 `note_tool` 專案中導入 `shadcn/ui` 重構既有畫面層與互動元件，維持現有功能、資料流程、API 呼叫與路由行為不變。此次重構聚焦於 UI 結構、樣式一致性、可維護性與元件可重用性，不改動產品功能範圍。

## 現況摘要

- 專案為 `Next.js 14 + React 18 + TypeScript + Tailwind CSS v4`
- 目前 UI 主要由大量頁面內嵌 Tailwind class 與自製 overlay/modal/menu 組成
- 核心畫面集中於：
  - `app/(app)/dashboard/page.tsx`
  - `app/(app)/cards/page.tsx`
  - `app/(app)/cards/[id]/page.tsx`
  - `app/(app)/boards/page.tsx`
  - `app/(app)/boards/[id]/page.tsx`
  - `app/(app)/layout.tsx`
- 既有複雜互動包含：
  - 卡片建立、編輯、刪除、分享、移除白板
  - 卡片搜尋、篩選、分頁
  - 白板建立、編輯、封存、複製到 space
  - 白板 detail 畫面的拖曳、縮放、區域標記、分享
  - 行動版與桌面版差異化 UI

## 重構原則

1. 功能不變
   - API payload、state 邏輯、權限判斷、router 導向、localStorage key 一律保留。
2. 先建基礎，再替換頁面
   - 先導入 design tokens、基礎元件、共用 wrapper，再逐頁遷移。
3. 優先替換高重複 UI
   - Dialog、Dropdown Menu、Button、Input、Textarea、Sheet、Tabs、Popover、Badge、Card、Select、Tooltip。
4. 保留高度客製互動區
   - 白板拖曳/縮放 canvas 區不為了 shadcn 強行改寫，只替換其外圍控制列、面板、彈窗與表單。
5. 分階段交付
   - 每一階段都可單獨驗證並保持可運行，避免一次性大改造成回歸風險。

## 執行階段

### Phase 0：盤點與基線建立

目的：先確保重構前後有可對照的功能與畫面基準。

工作項目：

- 盤點所有自製 UI primitive 與使用位置：
  - modal / overlay
  - dropdown / kebab menu
  - search input
  - form controls
  - side panel
  - confirm dialog
- 建立畫面重構清單與對應檔案映射
- 補齊重構驗證清單：
  - cards list
  - card detail
  - boards list
  - board detail
  - shared pages
  - auth pages
- 以目前版本作為視覺與互動 baseline

產出：

- UI inventory 文件
- 手動驗證 checklist

### Phase 1：導入 shadcn 基礎層

目的：建立後續遷移所需的共用基礎。

工作項目：

- 安裝並初始化 `shadcn/ui`
- 補齊必要依賴，預計包含：
  - `class-variance-authority`
  - `clsx`
  - `tailwind-merge`
  - `lucide-react`
  - radix primitives（依元件需求）
- 建立 `components/ui/` 目錄
- 建立 `lib/utils.ts` 與 `cn()` helper
- 定義 theme tokens，整理到 `app/globals.css`
- 將現有顏色、圓角、陰影、字級整理為可重用 token
- 確認 Tailwind v4 與 shadcn 的相容配置方式

預計導入元件：

- `button`
- `input`
- `textarea`
- `label`
- `card`
- `dialog`
- `alert-dialog`
- `dropdown-menu`
- `sheet`
- `popover`
- `select`
- `tabs`
- `badge`
- `tooltip`
- `separator`
- `scroll-area`
- `skeleton`

產出：

- shadcn 基礎元件可在專案中直接使用
- 全域樣式具備一致 token

### Phase 2：建立 App Shell 與共用容器

目的：先把整體框架統一，降低後續頁面替換成本。

工作項目：

- 重構 `app/(app)/layout.tsx` 的側邊欄、頂部區塊、space/folder 操作區
- 以 shadcn 元件替換：
  - space menu
  - folder menu
  - create / rename / delete dialog
  - sidebar 摺疊與行動版面板
- 抽出共用 layout 元件：
  - `AppSidebar`
  - `AppTopbar`
  - `AppPageHeader`
  - `EntityActionMenu`
  - `ConfirmDialog`

產出：

- 統一的應用框架
- 菜單與彈窗行為標準化

### Phase 3：Cards 模組遷移

目的：優先處理卡片模組，因其重複 UI 最多且可驗證性高。

工作項目：

- 重構 `app/(app)/cards/page.tsx`
- 重構以下元件：
  - `components/CardOverlay.tsx`
  - `components/CardCreateOverlay.tsx`
  - `components/CardPreview.tsx`
  - `components/cards/CardActionsMenu.tsx`
  - `components/cards/CardShareLinksModal.tsx`
  - `components/cards/CardRemoveFromBoardModal.tsx`
  - `components/cards/CardCopyToSpaceModal.tsx`
- 以 shadcn 取代：
  - 搜尋列
  - board filter
  - view mode toggle
  - overflow actions
  - create/edit dialogs
  - confirm dialogs
  - sidepanel / modal 容器
- 將卡片列表 item 樣式與狀態顯示統一成可重用卡片元件

驗證重點：

- 搜尋、分頁、board filter 正常
- modal / sidepanel 開啟模式不變
- Share / Remove / Delete 流程不變
- mobile 與 desktop 行為一致

### Phase 4：Board List 模組遷移

目的：將 boards 列表頁與其管理行為遷移至統一設計語言。

工作項目：

- 重構 `app/(app)/boards/page.tsx`
- 重構 `components/boards/BoardCopyToSpaceModal.tsx`
- 以 shadcn 替換：
  - create board dialog
  - edit board dialog
  - delete confirmation
  - tag filter popover
  - board action dropdown
  - copy-to-space dialog
- 將 board card 樣式統一，整理 tag/badge/description 顯示規則

驗證重點：

- create / edit / delete / archive / copy 功能不變
- folder 篩選與 query/tag filter 可正常組合使用
- menu 開關與 click outside 邏輯穩定

### Phase 5：Board Detail 模組遷移

目的：保留白板核心互動邏輯，只重構周邊 UI。

工作項目：

- 重構 `app/(app)/boards/[id]/page.tsx`
- 保留以下邏輯與資料結構：
  - viewport
  - drag / resize
  - region drawing
  - share link 流程
  - card positioning
- 替換白板周邊 UI：
  - toolbar
  - create/import chooser
  - rename/share/delete dialogs
  - region naming/color form
  - search / import panels
  - copy-to-space dialog
  - board menu
- 若有必要，將白板周邊控制項拆為：
  - `BoardToolbar`
  - `BoardActionMenu`
  - `BoardShareDialog`
  - `BoardRegionDialog`
  - `BoardImportSheet`

驗證重點：

- 拖曳、縮放、建立區域、調整卡片寬度不可退化
- mobile 觸控與桌面滑鼠互動不受影響
- 分享連結建立、撤銷與密碼流程不變

### Phase 6：其餘頁面與一致性收尾

工作項目：

- 重構 `dashboard`、`auth`、`shared-card`、`shared-board` 等頁面
- 統一空狀態、錯誤狀態、loading state
- 整理 markdown editor / preview 周邊容器樣式
- 清理重複 class 與廢棄自製 UI 樣式
- 補上 accessibility 屬性檢查

驗證重點：

- 狀態頁與分享頁風格一致
- 鍵盤操作、focus ring、ARIA 行為合理

## 建議元件映射

| 既有型態 | shadcn / Radix 替代 |
| --- | --- |
| 自製 modal | `Dialog` / `AlertDialog` |
| 側邊滑出編輯面板 | `Sheet` |
| `...` 操作選單 | `DropdownMenu` |
| filter 下拉 | `Popover` + `Command` 或 `Select` |
| 狀態標籤 | `Badge` |
| 區塊容器 | `Card` |
| tab / mode 切換 | `Tabs` 或 segmented button 自訂封裝 |
| confirm 刪除 | `AlertDialog` |
| 表單欄位 | `Input` / `Textarea` / `Label` / `Select` |

## 預估調整檔案範圍

- `app/layout.tsx`
- `app/globals.css`
- `app/(app)/layout.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/cards/page.tsx`
- `app/(app)/cards/[id]/page.tsx`
- `app/(app)/boards/page.tsx`
- `app/(app)/boards/[id]/page.tsx`
- `components/`
- `components/cards/`
- `components/cards/detail/`
- `components/boards/`
- `lib/`

## 驗證策略

### 手動驗證

- cards：
  - 搜尋
  - 建立
  - 編輯
  - 刪除
  - Share
  - Remove from board
  - modal / sidepanel 切換
- boards：
  - 建立
  - 編輯
  - 封存 / 取消封存
  - 複製到 space
  - 搜尋 / tag filter
- board detail：
  - 新增卡片
  - 匯入既有卡片
  - 拖曳
  - resize
  - zoom / pan
  - region create / edit / delete
  - 分享與撤銷分享
- layout：
  - space 切換
  - folder 建立 / 重新命名 / 刪除 / 排序
  - mobile sidebar 開關

### 技術驗證

- `npm run lint`
- `npm run build`
- 若時間允許，補最少量 UI regression 截圖或 smoke test

## 主要風險

1. Tailwind v4 與 shadcn 初始化細節需先確認
   - 若直接沿用預設安裝流程，可能需調整樣式入口與 token 定義方式。
2. 白板 detail 頁面互動複雜
   - 不應將 canvas 區互動邏輯與 UI 換皮綁在同一個 PR。
3. 現有 click outside 與 local state 很多
   - 遷移到 Radix 後要避免雙重狀態管理造成 menu/dialog 開關異常。
4. markdown editor 樣式衝突
   - `@uiw/react-md-editor` 與全域 prose/shadcn token 需做樣式隔離。

## 建議執行順序

1. 建立 shadcn 基礎層與全域 token
2. 重構 App Shell
3. 重構 Cards 模組
4. 重構 Boards List 模組
5. 重構 Board Detail 周邊 UI
6. 收尾 shared/auth/dashboard 與樣式清理
7. 完整驗證與修補回歸問題

## 完成定義

符合以下條件才算完成：

- 所有既有功能可正常使用
- 主要畫面已改用 shadcn 基礎元件與統一 token
- 不再依賴分散且重複的自製 modal/menu/form 樣式
- `lint` 與 `build` 通過
- mobile 與 desktop 的核心流程皆驗證完成

## 備註

這次重構建議拆成多個小階段提交，不建議一次改完整個專案。最佳做法是先讓 `layout + cards` 穩定，再進入 `boards` 與 `board detail`，因為白板頁面互動複雜度最高，應獨立處理。

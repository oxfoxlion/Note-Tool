# note_tool 黑白模式主題規格

## 目標

將 `note_tool` 的視覺系統整理成可切換的兩種模式：

- `light`：白底、深色文字
- `dark`：黑底、淺色文字

重點不是做花俏配色，而是建立一套穩定的黑 / 白主題 contract，讓後續重構 `boards`、`board detail`、`shared pages` 時都能直接沿用，避免再次返工。

## 核心原則

1. 先用 token，不直接寫死顏色
   - 新元件與重構中的元件，優先使用 `background / foreground / card / border / muted / primary` 等 token。
2. 黑白模式只換 token，不換元件結構
   - UI 行為、版型、元件層級不因主題切換而改變。
3. 以可讀性為主
   - 黑模式不是純黑配純白到底，保留少量階層色避免刺眼。
4. 允許「局部固定深色區」存在
   - 例如 sidebar、board canvas control、code block，可保留為固定深色，但必須明確標註為特例。

## 模式命名

建議統一使用：

- `theme-light`
- `theme-dark`

不要再擴充 `theme-sand` 這類中間態，除非後續真的需要第三套品牌主題。

## Token Contract

以下 token 視為黑白模式的最小必備集合：

- `--background`
- `--foreground`
- `--card`
- `--card-foreground`
- `--popover`
- `--popover-foreground`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--muted`
- `--muted-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--destructive-foreground`
- `--border`
- `--input`
- `--ring`

app shell 額外保留：

- `--app-bg`
- `--app-foreground`
- `--panel-bg`
- `--panel-border`
- `--sidebar-bg`
- `--sidebar-fg`
- `--sidebar-muted`

## 顏色策略

### Light

用途：預設工作模式，偏「紙張」與「工具面板」感。

建議方向：

- `background`: 白色
- `card`: 淺灰
- `foreground`: 黑色
- `sidebar`: 淺灰
- `border`: 淺灰邊界
- `muted`: 比卡片再淡一點的灰
- `primary`: 黑色或近黑色實心按鈕

### Dark

用途：夜間使用、畫布感較強的工作模式。

建議方向：

- `background`: 深黑
- `card`: 淺黑
- `foreground`: 白色
- `sidebar`: 淺黑
- `border`: 深灰黑
- `muted`: 比 card 再亮一階的灰黑
- `primary`: 白色或高對比淺色按鈕

## 已確認的視覺偏好

目前已定稿的方向如下：

- Dark mode
  - 側邊欄：淺黑
  - 卡片底色：淺黑
  - 背景：深黑
  - 文字：白色
- Light mode
  - 側邊欄：淺灰
  - 背景：白色
  - 卡片底色：淺灰
  - 文字：黑色

實作時應優先尊重這組偏好，不要再回到偏藍、偏紫、偏 slate-heavy 的方向。

## 元件層級規則

### 一律跟 token 走

以下元件之後都應使用 token 或 shadcn variant，不要手寫 `slate-xxx` / `white`：

- page background
- card container
- dialog / sheet / popover
- input / textarea / select
- dropdown menu
- tabs / segmented switch
- pagination
- badge
- skeleton

### 可以保留特例

以下區塊可以暫時不完全跟著黑白模式切換，但要集中管理：

- sidebar
- markdown code block
- board toolbar
- board canvas 上的 region overlay

原因：

- 這些區域通常需要固定高對比或畫布語意，硬跟主題切換容易破壞辨識度。

## 不建議做法

- 不要在頁面內大量寫：
  - `bg-white`
  - `text-slate-900`
  - `border-slate-200`
  - `hover:bg-slate-50`
- 不要同一個元件一半用 token、一半用寫死顏色
- 不要先把頁面全部做成白色，再最後一次性改 dark

## 實作順序

### Step 1：先補全 token

在 [`app/globals.css`](/home/shao/note_tool/app/globals.css) 中明確整理：

- `:root`
- `.theme-light`
- `.theme-dark`

並確保 app shell token 也有 dark 對應值。

### Step 2：建立切換入口

建議後續加入：

- `data-theme="light" | "dark"` 或 root class
- localStorage 儲存使用者偏好
- 若尚未設定，才 fallback 到 `prefers-color-scheme`

### Step 3：重構中同步套用

後續在重構：

- `boards/page`
- `boards/[id]/page`
- `shared-card`
- `shared-board`
- `auth`

時，直接改用 token，不要再產生新的硬編碼顏色。

### Step 4：最後統一 polish

等主要頁面都改完後，再集中做：

- dark mode 對比修正
- hover / focus 樣式一致化
- 陰影與邊框密度調整
- sidebar / board toolbar 特例整理

## 對現有專案的具體要求

從現在開始，新增或重構 UI 時遵守：

1. `Button / Dialog / Sheet / DropdownMenu / Input / Tabs` 優先使用 shadcn 元件
2. 若一定要寫 class，優先用 token 對應的 utility
3. 只在以下情況允許寫死顏色：
   - danger state
   - code block
   - board 特殊視覺層
4. 若一個區塊暫時不能做 dark mode，需在 PR 或工作紀錄中標明「暫時特例」

## 下一步建議

在真正進 `boards` 模組之前，先做一次小規模主題整理：

1. 在 [`app/globals.css`](/home/shao/note_tool/app/globals.css) 補上正式 `.theme-dark`
2. 決定 app shell 的 dark 視覺策略
3. 加一個簡單的 theme state 切換機制
4. 之後每改一個頁面就直接吃這套 token

## 結論

黑白模式不應該等全部畫面改完才做，也不應該一開始就到處手修。正確做法是：

- 現在先定規格與 token contract
- 接下來的重構同步遵守
- 最後再做整體視覺收尾

這樣返工最少，也最能保證 UI 最後是統一的。

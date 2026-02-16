# TODO

- [ ] Board regions: 定義並實作「自動命名規則」（例如 `Region 1`, `Region 2`），避免多人同時操作時名稱重複；以前端暫時名稱為 fallback，最終名稱由後端規則決定並回傳。
- [ ] Markdown 預覽 checkbox 映射偏移：在 `split/preview` 模式，點擊上方 task 可能切換到下方 task。需修正為「點哪個就只切哪個」，並覆蓋 `CardDetailClient`、`CardOverlay`、`CardCreateOverlay` 三個入口；至少驗證 `- [ ]` 與 `1. [ ]` 兩種列表。

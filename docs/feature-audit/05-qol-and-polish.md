# 05 — Quality of Life & Polish Features

> UX improvements, keyboard shortcuts, search, caching, and developer ergonomics.

## Keyboard Shortcuts

### Existing
- [x] Cmd+K — Command palette (basic) — [Priority: MED]

### Planned
- [ ] Ctrl+S — Save current panel params to RAM — [Priority: HIGH]
- [ ] Ctrl+Shift+S — Commit all RAM writes to flash — [Priority: HIGH]
- [ ] Ctrl+Z — Revert last param change — [Priority: MED]
- [ ] Cmd+K — Global parameter search (extend existing command palette) — [Priority: HIGH]
- [ ] Escape — Close active modal/dialog — [Priority: MED]
- [ ] Ctrl+R — Refresh/reload current panel params — [Priority: LOW]

## Parameter Search & Navigation

### Existing
- [x] Parameter panel search (ParametersPanel) — Text search within param table — [Priority: HIGH]
- [x] Category filter in ParametersPanel — [Priority: MED]

### Planned
- [ ] Global parameter search via Cmd+K — Search all loaded params across panels — [Priority: HIGH]
- [ ] Fuzzy match (e.g., "batt fs" finds BATT_FS_CRT_ACT) — [Priority: MED]
- [ ] Navigate to param's panel on select — [Priority: MED]
- [ ] Show param metadata (description, range, units) in search results — [Priority: LOW]

## Panel State Persistence

### Existing
- [x] Settings persistence in localStorage (settings-store) — [Priority: HIGH]

### Planned
- [ ] Remember last-open FC panel in settings-store — [Priority: MED]
- [ ] Restore last-open panel on re-open — [Priority: MED]
- [ ] Remember panel scroll position — [Priority: LOW]

## Parameter Tooltips

- [x] Param names in ParameterGrid — [Priority: MED]
- [ ] Every param label in FC panels wrapped with Tooltip — [Priority: MED]
- [ ] Tooltip shows: description, range, units, default value — [Priority: MED]
- [ ] Tooltip data from param-metadata.ts — [Priority: MED]

## Parameter Favorites

### Existing
- [x] Favorite params in ParametersPanel (star icon, favoriteParams in settings) — [Priority: MED]

### Planned
- [ ] Star icon on every param across ALL FC panels — [Priority: MED]
- [ ] Favorites section at top of ParametersPanel — [Priority: LOW]
- [ ] Quick-access favorites panel/widget — [Priority: LOW]

## Parameter Compare

- [ ] Side-by-side diff of current FC vs imported .param file — [Priority: MED]
- [ ] Side-by-side diff of current FC vs defaults — [Priority: MED]
- [ ] Highlight differences with color coding — [Priority: MED]
- [ ] Import/export .param files (QGC/Mission Planner format) — [Priority: MED]

## Offline Parameter Cache

- [ ] Cache full param snapshot to IndexedDB on download — [Priority: MED]
- [ ] Show read-only cached params when disconnected — [Priority: MED]
- [ ] "Last synced" timestamp display — [Priority: LOW]
- [ ] Diff cached vs live params on reconnect — [Priority: LOW]

## Parameter Change Highlighting

- [ ] White = unchanged (matches loaded value) — [Priority: MED]
- [ ] Yellow = dirty (modified locally, not yet saved to RAM) — [Priority: HIGH]
- [ ] Orange = RAM-not-flash (saved to RAM but not committed to flash) — [Priority: HIGH]
- [ ] Blue = differs-from-default (current value != default) — [Priority: LOW]
- [ ] Red = out-of-range (value outside min/max from metadata) — [Priority: HIGH]

## UI Polish

- [x] Dark theme — [Priority: HIGH]
- [x] Toast notifications — [Priority: MED]
- [ ] Loading skeletons for FC panels — [Priority: MED]
- [ ] Error state components with retry buttons — [Priority: MED]
- [ ] Responsive panel layouts — [Priority: LOW]
- [ ] Panel collapse/expand animations — [Priority: LOW]

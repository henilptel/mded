# MDed TODO

## 🔴 P0: Bug Fixes (Do First)

- [x] Fix Toggle Sidebar Button - Button exists but handler isn't connected
- [x] Register Ctrl+/ for Shortcuts - Listed in modal but not in shortcut-manager
- [x] Register Ctrl+B, Ctrl+I, Ctrl+K - Listed as formatting shortcuts but not wired up

---

## 🟠 P1: Core Workflow (High Impact, Quick Wins)

- [x] Remember Last Note - On app reopen, load the last note you were editing (persist in config)
- [x] Global Hotkey: Capture Clipboard - Ctrl+Alt+V creates a new note from clipboard instantly, just shows notification
- [x] Clipboard Capture - Hotkey to save clipboard content as new note (error messages, URLs, code snippets)
- [x] Quick Note Popup - Tiny floating input field for rapid capture, Enter to save and hide
- [x] Copy Note as Plain Text - One-click copy entire note content
- [x] Duplicate Line - Ctrl+D duplicates current line (common IDE feature)
- [x] Shift+Delete - Delete current line

---

## 🟡 P2: Editor Improvements (Better Writing Experience)

- [x] Smart Lists - Enter continues list item; Enter twice exits list. Same with TODOs
- [x] Tab to Indent - Tab key inserts spaces or indents list items
- [x] Auto-Pair Brackets - When typing (, [, {, \*, `, auto-insert closing character
- [x] Font Size Controls - Zoom in/out (Ctrl++ / Ctrl+-) for the editor
- [x] Clickable Checkboxes in Preview - Click to toggle checkbox state from preview mode
- [x] Checkbox/Todo Statistics - Show "3/10 tasks completed" if note has checkboxes

---

## 🟢 P3: Navigation & Organization

- [x] Jump to Note by Name - Ctrl+P command palette to fuzzy-search and open notes
- [x] Arrow Key Note Navigation - Up/Down arrows in sidebar to navigate notes, Enter to open
- [x] Ctrl+Tab / Ctrl+Shift+Tab - Cycle through recent notes (like browser tabs)
- [x] Pinned Notes - Pin important notes to the top of the list
- [x] Sort Options - Sort notes by: Name, Modified Date, Created Date (ascending/descending)

---

## 🔵 P4: Window & Display

- [x] Resizable Minimal Mode - Let users resize the minimal mode window and remember the size
- [x] Opacity Slider - Adjust window transparency to see through to IDE
- [x] Pin to Corner - Quick snap to top-left, top-right, bottom-left, bottom-right with adjustable sizes
- [x] Dock to Screen Edge - Slide window to edge, becomes slim strip; hover to expand
- [x] Split View - Show two notes side by side within the same window

---

## 🟣 P5: System Integration

- [ ] Screenshot to Note - Paste screenshots directly into notes (save to assets folder, embed as markdown)
- [ ] Terminal Command Capture - Detect terminal command + output format when pasting
- [ ] Open With MDed - Register as handler for .md files so double-click opens in MDed
- [ ] Auto-Start on Boot - Option to launch MDed on system startup (hidden to tray)

---

## ⚪ P6: Future / Nice-to-Have

- [ ] Settings Panel/Modal - Dedicated settings UI instead of just shortcuts modal
- [ ] Clipboard History Panel - Show last 10 clipboard items in sidebar, click to paste
- [ ] Copy for Slack/Discord - Format markdown appropriately for chat apps
- [ ] Browser Extension: Quick Capture - Browser extension adds "Save to MDed" on right-click
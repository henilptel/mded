# MDed Roadmap - Lightweight & Handy Markdown Editor

> **Vision**: A fast, minimal, privacy-first markdown editor that stays out of your way.
> **Philosophy**: Do fewer things exceptionally well. No bloat.

---

## 🔴 P0: Critical - Editor Core (Foundation)

These are blocking issues that affect core usability.

- [ ] **Replace textarea with CodeMirror 6** - Current textarea lacks proper editing features
  - Inline markdown rendering (headers, bold, italic render while typing)
  - Proper undo/redo with history persistence
  - Better cursor handling and selection
  - Syntax highlighting in edit mode
  - ~50KB bundle, highly performant
  
- [ ] **Full-text search** - Currently only searches titles
  - Search note content, not just filenames
  - Highlight matches in results
  - Search-as-you-type in command palette (Ctrl+P)

- [ ] **Fix auto-save reliability** - Ensure no data loss
  - Debounced saves working correctly
  - Visual feedback when save fails
  - Recovery from failed saves

---

## 🟠 P1: High Impact - Quick Wins

Features that significantly improve daily workflow with minimal complexity.

- [ ] **Wiki-style links** `[[note-name]]`
  - Click to navigate between notes
  - Auto-complete suggestions while typing
  - Create new note if link target doesn't exist

- [ ] **Backlinks panel** - Show "What links here"
  - Small panel below editor or in sidebar
  - Click to jump to linking note

- [ ] **Daily notes** - One-click today's note
  - Keyboard shortcut (Ctrl+D or similar)
  - Auto-create with date-based filename
  - Optional template for daily notes

- [ ] **Templates** - Quick note scaffolding
  - Store in `~/.local/share/mded/templates/`
  - Select template when creating new note
  - Built-in: blank, daily, meeting, todo

- [ ] **Better keyboard navigation**
  - Vim-style navigation option (j/k in sidebar)
  - Quick folder switching
  - Tab through UI elements

---

## 🟡 P2: Medium Impact - Polish

Improvements that make the app feel more professional.

- [ ] **Export options**
  - Export to HTML (use existing marked.js)
  - Export to PDF (via print dialog or basic generation)
  - Copy as HTML (for pasting into rich text editors)

- [ ] **Math support (KaTeX)** - Essential for technical users
  - Inline math: `$E = mc^2$`
  - Block math: `$$\sum_{i=1}^n$$`
  - Lightweight, ~100KB

- [ ] **Mermaid diagrams** - Inline diagrams
  - Flowcharts, sequence diagrams
  - Render in preview mode
  - Lazy-load the library

- [ ] **Note statistics**
  - Word count, character count
  - Reading time estimate
  - Show in status bar (minimal)

- [ ] **Recent notes** - Quick access
  - Show last 5-10 opened notes
  - Keyboard shortcut to cycle recent

- [ ] **Drag and drop improvements**
  - Drag notes between folders
  - Drag files into editor (images, text files)
  - Drag to reorder pinned notes

---

## 🟢 P3: Nice to Have - Enhancements

Features that add value but aren't essential.

- [ ] **Simple sync via folder**
  - Let users set notes directory to Dropbox/iCloud/OneDrive folder
  - No built-in sync service (keep it simple)
  - Conflict detection (warn if file changed externally)

- [ ] **Custom CSS themes**
  - User-provided CSS file for customization
  - 2-3 built-in themes (dark, light, sepia)
  - Keep glassmorphism as default

- [ ] **Code block improvements**
  - Language detection
  - Copy code button
  - Line numbers option

- [ ] **Image handling improvements**
  - Paste images from clipboard (existing)
  - Resize images in preview
  - Image gallery view for assets folder

- [ ] **Focus mode enhancements**
  - Typewriter mode (keep cursor centered)
  - Highlight current paragraph
  - Hide all UI except text

- [ ] **Tag support**
  - Parse `#tags` in notes
  - Filter notes by tag
  - Tag auto-complete

---

## 🔵 P4: Future - Major Features

Larger features to consider after core is solid.

- [ ] **Mobile support (Tauri 2.0)**
  - iOS and Android builds
  - Touch-optimized UI
  - Same feature set, responsive layout

- [ ] **Simple plugin system**
  - JavaScript-based plugins
  - Limited API surface (keep it secure)
  - Community plugins directory

- [ ] **Graph view** - Visualize note connections
  - Only if wiki-links are implemented
  - Simple force-directed graph
  - Optional feature (not core)

- [ ] **Git integration**
  - Version history via git
  - Optional, for power users
  - Simple UI: commit, view history

- [ ] **AI features** (optional, local-only)
  - Local LLM summarization
  - Auto-tagging suggestions
  - Privacy-first (no cloud AI)

---

## ⚪ Won't Do - Out of Scope

Keeping MDed lightweight means saying no to:

- ❌ Real-time collaboration (use HackMD/HedgeDoc)
- ❌ Built-in cloud sync service (use folder sync)
- ❌ Complex database/vault system (keep it file-based)
- ❌ Electron migration (stay with Tauri)
- ❌ Heavy plugin ecosystem (keep core solid first)
- ❌ WYSIWYG block editor (CodeMirror inline is enough)
- ❌ Notion-like databases (different product)
- ❌ Calendar/task management (use dedicated apps)

---

## 🛠️ Technical Debt

Code quality improvements needed.

- [x] **Refactor app.ts** - 1200+ lines, needs splitting
  - Extract tab management to separate module
  - Extract modal handling
  - Extract keyboard shortcuts

- [ ] **Add proper TypeScript types**
  - Remove `any` types
  - Strict null checks
  - Better API response types

- [ ] **Error handling improvements**
  - Consistent error messages
  - User-friendly error display
  - Error logging for debugging

- [ ] **Testing**
  - Unit tests for Rust backend (some exist)
  - Frontend component tests
  - E2E tests for critical flows

- [ ] **Performance profiling**
  - Measure startup time
  - Measure note loading time
  - Optimize hot paths

---

## 📊 Success Metrics

How we know MDed is achieving its goals:

1. **Startup time**: < 500ms to usable
2. **Note switching**: < 100ms
3. **Search results**: < 200ms for 1000 notes
4. **Bundle size**: < 5MB total app size
5. **Memory usage**: < 100MB idle, < 200MB active
6. **No data loss**: 0 reported incidents

---

## 🎯 Current Sprint Focus

**Next 2-4 weeks:**
1. CodeMirror 6 integration (P0)
2. Full-text search (P0)
3. Wiki-links basic support (P1)

**Following sprint:**
1. Backlinks panel (P1)
2. Daily notes (P1)
3. Templates (P1)

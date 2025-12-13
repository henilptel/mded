# Requirements Document

## Introduction

This document specifies the requirements for migrating the mded markdown editor from a plain `<textarea>` element to CodeMirror 6. The current textarea-based implementation has fundamental limitations including no syntax highlighting, limited undo/redo (relies on deprecated `document.execCommand`), poor cursor handling, and no support for advanced editing features. CodeMirror 6 provides a modern, extensible editor framework that addresses these limitations while maintaining a reasonable bundle size (~50KB) suitable for a desktop Tauri application.

## Glossary

- **CodeMirror 6**: A modern, extensible code editor library for the web with excellent TypeScript support
- **EditorManager**: The class responsible for managing the editor instance, content, and user interactions
- **EditorState**: CodeMirror's immutable representation of the editor's current state (document, selection, extensions)
- **EditorView**: CodeMirror's DOM representation and event handling layer
- **Extension**: A CodeMirror plugin that adds functionality (syntax highlighting, keybindings, etc.)
- **Transaction**: An atomic change to the editor state in CodeMirror
- **Markdown AST**: Abstract Syntax Tree representation of parsed markdown content
- **Preview Mode**: Display mode showing rendered HTML instead of raw markdown
- **Task List Item**: A markdown checkbox item in the format `- [ ]` or `- [x]`

## Requirements

### Requirement 1

**User Story:** As a user, I want syntax highlighting while editing markdown, so that I can easily distinguish between different markdown elements (headers, code, links, etc.).

#### Acceptance Criteria

1. WHEN the user types markdown content THEN the EditorManager SHALL apply syntax highlighting to headers, bold, italic, code blocks, links, and lists within 100ms
2. WHEN the user opens a note containing markdown THEN the EditorManager SHALL render the content with appropriate syntax highlighting
3. WHEN the color theme changes THEN the EditorManager SHALL update syntax highlighting colors to match the theme

### Requirement 2

**User Story:** As a user, I want reliable undo/redo functionality, so that I can easily revert or restore changes while editing.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+Z (or Cmd+Z on macOS) THEN the EditorManager SHALL revert the most recent change
2. WHEN the user presses Ctrl+Shift+Z (or Cmd+Shift+Z on macOS) THEN the EditorManager SHALL restore the most recently undone change
3. WHEN the user performs multiple edits THEN the EditorManager SHALL maintain a history stack of at least 100 operations
4. WHEN the user undoes a change THEN the EditorManager SHALL restore the cursor position to where it was before that change

### Requirement 3

**User Story:** As a user, I want line numbers displayed in the editor, so that I can easily navigate and reference specific lines.

#### Acceptance Criteria

1. WHEN the editor displays content THEN the EditorManager SHALL show line numbers in a gutter on the left side
2. WHEN the user adds or removes lines THEN the EditorManager SHALL update line numbers immediately
3. WHEN the user clicks on a line number THEN the EditorManager SHALL select the entire line

### Requirement 4

**User Story:** As a user, I want the editor to maintain all existing functionality, so that my workflow is not disrupted by the migration.

#### Acceptance Criteria

1. WHEN the user toggles preview mode THEN the EditorManager SHALL switch between edit and preview views
2. WHEN the user clicks a checkbox in preview mode THEN the EditorManager SHALL toggle the corresponding task item in the source markdown
3. WHEN the user pastes an image THEN the EditorManager SHALL save the image and insert a markdown image reference
4. WHEN the user pastes terminal output THEN the EditorManager SHALL wrap the content in a code block
5. WHEN the user presses Enter on a list item THEN the EditorManager SHALL continue the list with the appropriate marker
6. WHEN the user types an opening bracket or quote THEN the EditorManager SHALL insert the matching closing character
7. WHEN the user changes font size THEN the EditorManager SHALL scale the editor text accordingly
8. WHEN the user uses markdown formatting shortcuts THEN the EditorManager SHALL insert or toggle the appropriate markdown syntax

### Requirement 5

**User Story:** As a user, I want the editor to serialize and deserialize content correctly, so that my notes are saved and loaded without data loss.

#### Acceptance Criteria

1. WHEN the user saves a note THEN the EditorManager SHALL provide the exact text content without modification
2. WHEN a note is loaded THEN the EditorManager SHALL display the content exactly as stored
3. WHEN the user edits and saves content THEN the EditorManager SHALL preserve all whitespace and formatting

### Requirement 6

**User Story:** As a developer, I want the EditorManager API to remain compatible, so that other components can interact with the editor without changes.

#### Acceptance Criteria

1. WHEN external code calls `getContent()` THEN the EditorManager SHALL return the current document text as a string
2. WHEN external code calls `setContent(content)` THEN the EditorManager SHALL replace the document with the provided text
3. WHEN external code calls `focus()` THEN the EditorManager SHALL give keyboard focus to the editor
4. WHEN external code calls `clear()` THEN the EditorManager SHALL empty the document and reset state
5. WHEN external code calls `isContentChanged()` THEN the EditorManager SHALL return true if content differs from the last saved state
6. WHEN the editor content changes THEN the EditorManager SHALL invoke the `onInput` callback
7. WHEN task list statistics change THEN the EditorManager SHALL invoke the `onStatsUpdate` callback with completed and total counts

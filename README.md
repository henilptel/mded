# MDed - Minimalistic Markdown Editor

A modern, fast, and minimalistic Markdown editor for Linux capable of handling folder-based note organization, featuring a sleek "VisionOS" glassmorphism aesthetic.

## Features

- **VisionOS Design**: Premium dark glassmorphism UI with sophisticated blur effects, translucent layers, and subtle animations.
- **Folder Management**: Organize your notes into folders and subdirectories seamlessly.
- **Markdown Editing**: Full markdown support with live preview, syntax highlighting, and Vim mode.
- **Global Shortcut**: customizable global hotkey (default: `CommandOrControl+Shift+N`) to toggle the editor visibility from anywhere in your OS.
- **Window Persistence**: Remembers your window size and position across sessions.
- **Collapsible Sidebar**: Maximize your writing space by toggling the sidebar.
- **Minimal Mode**: "Always-on-top" focus mode with only the editor visible.
- **Auto-save**: Notes are automatically saved after inactivity.
- **System Tray**: Minimize to system tray for background operation.
- **Frameless Window**: Custom titlebar with integrated window controls.

## Tech Stack

- **Electron**: For cross-platform desktop integration.
- **TypeScript**: Strictly typed codebase for reliability.
- **Vanilla DOM**: Lightweight performance without heavy framework overhead.
- **Marked.js**: Fast markdown parsing.
- **Highlight.js**: Syntax highlighting for code blocks.

## Requirements

- Node.js 18+ recommended
- Linux (X11 or Wayland)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Mode

Run the app in development mode with hot-reload support:

```bash
npm run dev
```

Or watch for changes:

```bash
npm run watch
```

### Build for Linux

Create a production-ready AppImage and .deb package:

```bash
npm run package
```

The output will be in the `dist/` directory.

## Usage

- **Create Note**: Click the `+` button in the sidebar or use `Ctrl+N`.
- **Create Folder**: Use the folder button to organize notes.
- **Global Toggle**: Press `Ctrl+Shift+N` (configurable) to show/hide the app instantly.
- **Vim Mode**: Toggle Vim keybindings in the toolbar for keyboard-centric editing.
- **Minimal Mode**: Click the focus icon to float the window and hide UI elements.
- **Storage**: Notes are stored in `~/.mded/notes/` as standard `.md` files.

## Keyboard Shortcuts

- **General**:
  - `Ctrl+S`: Save immediately
  - `Ctrl+N`: New Note
  - `Ctrl+E`: Toggle Preview
  - `Ctrl+Shift+N`: Global Show/Hide (Configurable via Settings)
- **Editor**: Supports standard editing keys. Enable Vim mode for modal editing.

# MDed - Minimalistic Markdown Editor

A modern, dark glassmorphism-styled Markdown editor for Linux with sleek black design aesthetics.

## Features

- **Modern Black Design**: Sleek dark glassmorphism UI with subtle blur effects
- **Markdown Editing**: Full markdown support with live preview toggle
- **Collapsible Sidebar**: Toggle sidebar visibility to maximize editing space
- **Minimal Mode**: Always-on-top mode with only the editor visible (perfect for quick notes)
- **Local Storage**: Notes stored as `.md` files in `~/.mded/notes/`
- **System Tray**: Minimize to system tray for quick access
- **Frameless Window**: Custom titlebar with window controls
- **Toolbar**: Quick formatting buttons for bold, italic, headings, links, code, lists
- **Auto-save**: Automatic saving after 1 second of inactivity
- **Lightweight**: Fast and efficient Electron-based application

## Requirements

- Node.js 16+
- Linux with X11 or Wayland display server
- Running graphical desktop environment

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm start
```

Or use the run script:
```bash
./run.sh
```

### Build for Linux

```bash
npm run build
```

This will create an AppImage and .deb package in the `dist/` folder.

## Usage

- **Create Note**: Click the `+` button in the sidebar
- **Switch Notes**: Click on any note in the sidebar
- **Toggle Sidebar**: Click the sidebar icon in the titlebar to collapse/expand the sidebar
- **Minimal Mode**: Click the focus icon to enable always-on-top minimal mode (editor only, no toolbar)
- **Edit/Preview**: Toggle between edit and preview mode using the button in the toolbar
- **Format Text**: Use the toolbar buttons for quick markdown formatting
- **Delete Note**: Click the trash icon to delete the current note
- **System Tray**: Click the close button to minimize to system tray
- **Window Controls**: Use the custom titlebar buttons to minimize, maximize, or close

## Storage

All notes are stored in `~/.mded/notes/` as individual markdown files. You can access and edit these files directly with any text editor.

## Keyboard Shortcuts

The editor supports standard text editing shortcuts. Use the toolbar for markdown-specific formatting.

## Tech Stack

- Electron
- Vanilla JavaScript
- Marked.js (Markdown parser)
- Custom CSS with glassmorphism effects

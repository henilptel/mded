# MDed - Minimalistic Markdown Editor

A modern, fast, and minimalistic Markdown editor for **Windows, macOS, and Linux** featuring folder-based note organization and a sleek "VisionOS" glassmorphism aesthetic.

## Features

- **VisionOS Design**: Premium dark glassmorphism UI with sophisticated blur effects, translucent layers, and subtle animations.
- **Folder Management**: Organize your notes into folders and subdirectories seamlessly.
- **Markdown Editing**: Full markdown support with live preview and syntax highlighting.
- **Tabbed Editing**: Open multiple notes in tabs for easy multitasking.
- **Command Palette**: Quick note navigation with `Ctrl+P` (Windows/Linux) or `Cmd+P` (macOS).
- **Global Shortcut**: Customizable global hotkey (default: `Ctrl+Shift+N` / `Cmd+Shift+N`) to toggle the editor visibility from anywhere in your OS.
- **Window Persistence**: Remembers your window size and position across sessions.
- **Collapsible Sidebar**: Maximize your writing space by toggling the sidebar.
- **Minimal Mode**: "Always-on-top" focus mode with only the editor visible.
- **Auto-save**: Notes are automatically saved after inactivity.
- **System Tray**: Minimize to system tray for background operation.
- **Frameless Window**: Custom titlebar with integrated window controls.
- **Adjustable Opacity**: Configure window transparency for overlay use.
- **Snap to Corner**: Quickly position window to screen corners.
- **Screenshot Paste**: Paste images directly from clipboard; auto-saved to assets folder.
- **Terminal Output Detection**: Pasted terminal output auto-wraps in code blocks.
- **Auto-Start on Boot**: Option to launch hidden to tray on system startup (all platforms).

## Tech Stack

- **Electron**: For cross-platform desktop integration.
- **TypeScript**: Strictly typed codebase for reliability.
- **Vanilla DOM**: Lightweight performance without heavy framework overhead.
- **Marked.js**: Fast markdown parsing.
- **Highlight.js**: Syntax highlighting for code blocks.

## Requirements

- Node.js 18+ recommended

## Supported Platforms

| Platform | Formats |
|----------|---------|
| Windows | NSIS installer, Portable |
| macOS | DMG, ZIP |
| Linux | AppImage, DEB |

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Mode

Run the app in development mode:

```bash
npm run dev
```

Or watch for changes:

```bash
npm run watch
```

### Build for Production

Build for your current platform:

```bash
npm run package
```

Build for specific platforms:

```bash
# Windows
npm run package:win

# macOS
npm run package:mac

# Linux
npm run package:linux

# All platforms
npm run package:all
```

The output will be in the `dist/` directory.

### Register as Default .md Handler (Linux)

Copy the desktop entry to your applications directory:

```bash
cp MDed.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/
```

Then set MDed as the default handler for markdown files.

## Data Storage

Notes and configuration are stored in platform-specific locations:

| Platform | Location |
|----------|----------|
| Windows | `%USERPROFILE%\.mded\` |
| macOS | `~/.mded/` |
| Linux | `~/.mded/` |

- **Notes**: `{data_dir}/notes/`
- **Assets**: `{data_dir}/assets/`
- **Config**: `{data_dir}/config.json`

## Usage

- **Create Note**: Click the `+` button in the sidebar or use `Ctrl/Cmd+N`.
- **Create Folder**: Use the folder button to organize notes.
- **Command Palette**: Press `Ctrl/Cmd+P` to quickly jump to any note.
- **Global Toggle**: Press `Ctrl/Cmd+Shift+N` (configurable) to show/hide the app instantly.
- **Minimal Mode**: Click the focus icon to float the window and hide UI elements.
- **Paste Screenshots**: Copy an image to clipboard and paste into the editor.
- **Paste Terminal Output**: Copy terminal output and paste; auto-formats as code block.
- **Auto-Start**: Enable in Display Settings to launch on boot (hidden to tray).

## Keyboard Shortcuts

### General
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+S` | Save note |
| `Ctrl/Cmd+N` | New note |
| `Ctrl/Cmd+P` | Command palette |
| `Ctrl/Cmd+E` | Toggle preview |
| `Ctrl/Cmd+/` | Show shortcuts |
| `Ctrl/Cmd+Shift+E` | Focus sidebar |
| `Escape` | Close modals |

### Tabs
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+Tab` | Next tab |
| `Ctrl/Cmd+Shift+Tab` | Previous tab |
| `Ctrl/Cmd+W` | Close tab |

### Formatting
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+B` | Bold |
| `Ctrl/Cmd+I` | Italic |
| `Ctrl/Cmd+K` | Insert link |

### Editor
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+D` | Duplicate line |
| `Shift+Delete` | Delete line |
| `Ctrl/Cmd+=` | Increase font size |
| `Ctrl/Cmd+-` | Decrease font size |
| `Tab` | Indent / continue list |
| `Shift+Tab` | Outdent |

### Global
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+Shift+N` | Show/hide app (configurable) |
| `Ctrl/Cmd+Alt+V` | Capture clipboard to new note |
| `Ctrl/Cmd+Alt+N` | Quick note popup |
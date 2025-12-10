# MDed - Minimalistic Markdown Editor

A modern, fast, and minimalistic Markdown editor for Linux capable of handling folder-based note organization, featuring a sleek "VisionOS" glassmorphism aesthetic.

## Features

- **VisionOS Design**: Premium dark glassmorphism UI with sophisticated blur effects, translucent layers, and subtle animations.
- **Folder Management**: Organize your notes into folders and subdirectories seamlessly.
- **Markdown Editing**: Full markdown support with live preview and syntax highlighting.
- **Tabbed Editing**: Open multiple notes in tabs for easy multitasking.
- **Command Palette**: Quick note navigation with `Ctrl+P`.
- **Global Shortcut**: Customizable global hotkey (default: `Ctrl+Shift+N`) to toggle the editor visibility from anywhere in your OS.
- **Window Persistence**: Remembers your window size and position across sessions.
- **Collapsible Sidebar**: Maximize your writing space by toggling the sidebar.
- **Minimal Mode**: "Always-on-top" focus mode with only the editor visible.
- **Auto-save**: Notes are automatically saved after inactivity.
- **System Tray**: Minimize to system tray for background operation.
- **Frameless Window**: Custom titlebar with integrated window controls.
- **Adjustable Opacity**: Configure window transparency for overlay use.
- **Snap to Corner**: Quickly position window to screen corners.
- **Screenshot Paste**: Paste images directly from clipboard; auto-saved to `~/.mded/assets/`.
- **Terminal Output Detection**: Pasted terminal output auto-wraps in code blocks.
- **Open With MDed**: Double-click `.md` files to open in MDed (register via `.desktop` file).
- **Auto-Start on Boot**: Option to launch hidden to tray on system startup.

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

Run the app in development mode:

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

### Register as Default .md Handler

Copy the desktop entry to your applications directory:

```bash
cp MDed.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/
```

Then set MDed as the default handler for markdown files.

## Usage

- **Create Note**: Click the `+` button in the sidebar or use `Ctrl+N`.
- **Create Folder**: Use the folder button to organize notes.
- **Command Palette**: Press `Ctrl+P` to quickly jump to any note.
- **Global Toggle**: Press `Ctrl+Shift+N` (configurable) to show/hide the app instantly.
- **Minimal Mode**: Click the focus icon to float the window and hide UI elements.
- **Paste Screenshots**: Copy an image to clipboard and paste into the editor.
- **Paste Terminal Output**: Copy terminal output and paste; auto-formats as code block.
- **Auto-Start**: Enable in Display Settings to launch on boot (hidden to tray).
- **Storage**: Notes are stored in `~/.mded/notes/` as standard `.md` files.
- **Assets**: Pasted images are stored in `~/.mded/assets/`.

## Keyboard Shortcuts

### General
| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save note |
| `Ctrl+N` | New note |
| `Ctrl+P` | Command palette |
| `Ctrl+E` | Toggle preview |
| `Ctrl+/` | Show shortcuts |
| `Ctrl+Shift+E` | Focus sidebar |
| `Escape` | Close modals |

### Tabs
| Shortcut | Action |
|----------|--------|
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+W` | Close tab |

### Formatting
| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+K` | Insert link |

### Editor
| Shortcut | Action |
|----------|--------|
| `Ctrl+D` | Duplicate line |
| `Shift+Delete` | Delete line |
| `Ctrl+=` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Tab` | Indent / continue list |
| `Shift+Tab` | Outdent |

### Global
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+N` | Show/hide app (configurable) |
| `Ctrl+Alt+V` | Capture clipboard to new note |
| `Ctrl+Alt+N` | Quick note popup |
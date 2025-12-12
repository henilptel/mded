# Requirements Document

## Introduction

This document specifies the requirements for migrating MDed, a cross-platform markdown editor with VisionOS glassmorphism design, from Electron to Tauri 2.x. The migration involves a complete rewrite of the backend (Rust) while preserving the existing TypeScript frontend with vanilla DOM approach. The goal is to maintain feature parity with the current Electron implementation while leveraging Tauri's smaller binary size and improved performance.

## Glossary

- **MDed**: The Minimalistic Markdown Editor application being migrated
- **Tauri**: A framework for building desktop applications with web frontends and Rust backends
- **IPC**: Inter-Process Communication between frontend and backend
- **System Tray**: Operating system notification area icon for background applications
- **Global Shortcut**: Keyboard shortcut that works system-wide, even when the application is not focused
- **Frameless Window**: A window without the default operating system title bar and borders
- **Minimal Mode**: A compact, always-on-top window mode for focused writing
- **Quick Note**: A floating popup window for rapid note capture
- **Path Traversal**: A security vulnerability where user input could access files outside intended directories

## Requirements

### Requirement 1: Project Initialization

**User Story:** As a developer, I want to initialize a Tauri 2.x project with proper configuration, so that I can build the application for Windows, macOS, and Linux.

#### Acceptance Criteria

1. WHEN the project is initialized THEN the Tauri_Application SHALL use Tauri 2.x with Rust backend and TypeScript frontend
2. WHEN configuring the package manager THEN the Tauri_Application SHALL use pnpm as the package manager
3. WHEN building the application THEN the Tauri_Application SHALL target Windows, macOS, and Linux platforms
4. WHEN the frontend is configured THEN the Tauri_Application SHALL preserve the existing vanilla DOM approach from the Electron implementation

### Requirement 2: Window Configuration

**User Story:** As a user, I want the application window to have a custom frameless design with transparency, so that I can enjoy the glassmorphism aesthetic.

#### Acceptance Criteria

1. WHEN the main window is created THEN the Window_Manager SHALL render a frameless transparent window with custom titlebar
2. WHEN the window is resized THEN the Window_Manager SHALL enforce minimum dimensions of 300x200 pixels
3. WHEN the application starts THEN the Window_Manager SHALL restore the previously saved window bounds (position and size)
4. WHEN the window is moved or resized THEN the Window_Manager SHALL persist the new bounds to configuration storage
5. WHEN the user closes the window THEN the Window_Manager SHALL hide the window to system tray instead of terminating the application

### Requirement 3: Single Instance Lock

**User Story:** As a user, I want only one instance of the application to run at a time, so that I don't accidentally open multiple conflicting instances.

#### Acceptance Criteria

1. WHEN a second instance is launched THEN the Instance_Manager SHALL focus the existing window instead of creating a new instance
2. WHEN a second instance is launched with a file argument THEN the Instance_Manager SHALL open that file in the existing instance
3. WHEN the existing instance is minimized THEN the Instance_Manager SHALL restore the window before focusing it

### Requirement 4: System Tray Integration

**User Story:** As a user, I want the application to minimize to the system tray, so that I can keep it running in the background without cluttering my taskbar.

#### Acceptance Criteria

1. WHEN the application starts THEN the System_Tray SHALL display an icon in the system notification area
2. WHEN the user clicks the tray icon THEN the System_Tray SHALL toggle the main window visibility
3. WHEN the user right-clicks the tray icon THEN the System_Tray SHALL display a context menu with "Show" and "Quit" options
4. WHEN the user selects "Quit" from the tray menu THEN the System_Tray SHALL terminate the application completely

### Requirement 5: Minimal Mode

**User Story:** As a user, I want a minimal always-on-top mode for focused writing, so that I can keep notes visible while working in other applications.

#### Acceptance Criteria

1. WHEN the user enters minimal mode THEN the Window_Manager SHALL set the window to always-on-top and resize to saved minimal bounds
2. WHEN the user exits minimal mode THEN the Window_Manager SHALL restore the previous window bounds and disable always-on-top
3. WHEN the window is resized in minimal mode THEN the Window_Manager SHALL persist the minimal mode bounds separately from normal bounds
4. WHILE in minimal mode THEN the Window_Manager SHALL prevent window maximization

### Requirement 6: Window Opacity

**User Story:** As a user, I want to adjust the window transparency, so that I can see content behind the editor while writing.

#### Acceptance Criteria

1. WHEN the user adjusts opacity THEN the Window_Manager SHALL set window transparency between 30% and 100%
2. WHEN the opacity is changed THEN the Window_Manager SHALL persist the opacity value to configuration
3. WHEN the application starts THEN the Window_Manager SHALL restore the previously saved opacity value

### Requirement 7: Global Shortcuts

**User Story:** As a user, I want global keyboard shortcuts that work even when the application is hidden, so that I can quickly access the editor from anywhere.

#### Acceptance Criteria

1. WHEN the toggle shortcut is pressed (default Ctrl+Shift+N) THEN the Shortcut_Manager SHALL toggle the main window visibility
2. WHEN the clipboard capture shortcut is pressed (Ctrl+Alt+V) THEN the Shortcut_Manager SHALL create a new note from clipboard content and display a notification
3. WHEN the quick note shortcut is pressed (Ctrl+Alt+N) THEN the Shortcut_Manager SHALL display the quick note popup window
4. WHEN the user configures a new toggle shortcut THEN the Shortcut_Manager SHALL register the new shortcut and persist it to configuration
5. WHEN a shortcut registration fails THEN the Shortcut_Manager SHALL return an error result to the frontend

### Requirement 8: Quick Note Popup

**User Story:** As a user, I want a floating quick note popup, so that I can capture thoughts instantly without opening the full editor.

#### Acceptance Criteria

1. WHEN the quick note popup is triggered THEN the Quick_Note_Window SHALL display a frameless, always-on-top, transparent window
2. WHEN the user presses Enter in the quick note popup THEN the Quick_Note_Window SHALL save the content as a new note and hide the popup
3. WHEN the quick note popup loses focus THEN the Quick_Note_Window SHALL hide the popup
4. WHEN the user presses Escape in the quick note popup THEN the Quick_Note_Window SHALL hide the popup without saving

### Requirement 9: File System Structure

**User Story:** As a user, I want my notes and configuration stored in a platform-appropriate location, so that my data is organized and accessible.

#### Acceptance Criteria

1. WHEN the application initializes THEN the File_System SHALL create the data directory structure in the platform-appropriate user data location
2. WHEN storing notes THEN the File_System SHALL save markdown files in the `notes/` subdirectory
3. WHEN storing screenshots THEN the File_System SHALL save image files in the `assets/` subdirectory
4. WHEN storing user preferences THEN the File_System SHALL save configuration in `config.json`
5. WHEN storing note ordering THEN the File_System SHALL save custom ordering in `note-order.json`

### Requirement 10: Folder Operations

**User Story:** As a user, I want to organize my notes into folders, so that I can categorize and find them easily.

#### Acceptance Criteria

1. WHEN listing folders THEN the Folder_Manager SHALL return all directories in the notes directory including an "All Notes" virtual folder
2. WHEN creating a folder THEN the Folder_Manager SHALL create a new directory with the specified name
3. WHEN deleting a folder THEN the Folder_Manager SHALL recursively remove the folder and all contained notes
4. WHEN renaming a folder THEN the Folder_Manager SHALL rename the directory and preserve all contained notes

### Requirement 11: Note Operations

**User Story:** As a user, I want to create, read, update, and delete notes, so that I can manage my markdown content.

#### Acceptance Criteria

1. WHEN listing notes THEN the Note_Manager SHALL return all markdown files with metadata (id, title, modified date, created date, folder, pinned status)
2. WHEN listing notes with a folder filter THEN the Note_Manager SHALL return only notes in the specified folder
3. WHEN reading a note THEN the Note_Manager SHALL return the file content as a string
4. WHEN saving a note THEN the Note_Manager SHALL write the content to the file and update the modified timestamp
5. WHEN creating a note THEN the Note_Manager SHALL generate a UUID-based filename and create the file with default content
6. WHEN deleting a note THEN the Note_Manager SHALL remove the file and update pinned notes list if necessary
7. WHEN renaming a note THEN the Note_Manager SHALL rename the file and update any references in pinned notes
8. WHEN moving a note THEN the Note_Manager SHALL relocate the file from source folder to target folder

### Requirement 12: Note Pinning and Ordering

**User Story:** As a user, I want to pin important notes and customize their order, so that I can prioritize frequently accessed content.

#### Acceptance Criteria

1. WHEN toggling pin status THEN the Note_Manager SHALL add or remove the note from the pinned notes list and persist the change
2. WHEN retrieving note order THEN the Note_Manager SHALL return the custom ordering from note-order.json
3. WHEN saving note order THEN the Note_Manager SHALL persist the ordering to note-order.json
4. WHEN listing notes THEN the Note_Manager SHALL return pinned notes first, followed by unpinned notes

### Requirement 13: Path Security

**User Story:** As a developer, I want path validation to prevent directory traversal attacks, so that user-provided filenames cannot access files outside the intended directories.

#### Acceptance Criteria

1. WHEN a path contains ".." THEN the Path_Validator SHALL reject the path with an error
2. WHEN a path contains "/" or "\\" separators THEN the Path_Validator SHALL reject the path with an error
3. WHEN a resolved path is outside the base directory THEN the Path_Validator SHALL reject the path with an error
4. WHEN a path is validated THEN the Path_Validator SHALL return the resolved absolute path

### Requirement 14: Screenshot Handling

**User Story:** As a user, I want to paste screenshots directly into my notes, so that I can include visual content without manual file management.

#### Acceptance Criteria

1. WHEN saving a screenshot THEN the Asset_Manager SHALL decode the base64 image data and save it to the assets directory with a unique filename
2. WHEN saving a screenshot THEN the Asset_Manager SHALL return the file path for markdown image reference
3. WHEN requesting the assets path THEN the Asset_Manager SHALL return the absolute path to the assets directory

### Requirement 15: External File Opening

**User Story:** As a user, I want to open external markdown files, so that I can edit files from my file system.

#### Acceptance Criteria

1. WHEN opening an external file THEN the File_Reader SHALL validate that the file has a .md extension
2. WHEN opening an external file THEN the File_Reader SHALL read and return the file content, filename, and absolute path
3. WHEN opening an inaccessible file THEN the File_Reader SHALL return an error result

### Requirement 16: Auto-Start on Boot

**User Story:** As a user, I want the application to optionally start on system boot, so that it's always available in the background.

#### Acceptance Criteria

1. WHEN enabling auto-start THEN the Auto_Start_Manager SHALL configure the application to launch on system boot with the --hidden flag
2. WHEN disabling auto-start THEN the Auto_Start_Manager SHALL remove the application from system startup
3. WHEN querying auto-start status THEN the Auto_Start_Manager SHALL return the current enabled state

### Requirement 17: Configuration Persistence

**User Story:** As a user, I want my preferences to persist across sessions, so that I don't have to reconfigure the application each time.

#### Acceptance Criteria

1. WHEN saving configuration THEN the Config_Manager SHALL debounce writes to avoid excessive disk operations
2. WHEN loading configuration THEN the Config_Manager SHALL merge saved values with default configuration
3. WHEN the application starts THEN the Config_Manager SHALL restore the last opened note and folder
4. WHEN a note is opened THEN the Config_Manager SHALL persist the note ID and folder as the last opened note

### Requirement 18: Display Information

**User Story:** As a user, I want the application to know my screen dimensions, so that windows can be positioned appropriately.

#### Acceptance Criteria

1. WHEN requesting display info THEN the Display_Manager SHALL return the primary display work area dimensions and position

### Requirement 19: IPC Command Interface

**User Story:** As a developer, I want a well-defined IPC interface between frontend and backend, so that the existing frontend can communicate with the new Rust backend.

#### Acceptance Criteria

1. WHEN the frontend invokes an IPC command THEN the IPC_Handler SHALL execute the corresponding Rust function and return the result
2. WHEN an IPC command fails THEN the IPC_Handler SHALL return a structured error result with success=false and error message
3. WHEN an IPC command succeeds THEN the IPC_Handler SHALL return a structured result with success=true and any relevant data

### Requirement 20: Frontend Preservation

**User Story:** As a developer, I want to preserve the existing frontend code with minimal changes, so that the migration focuses on the backend.

#### Acceptance Criteria

1. WHEN adapting the frontend THEN the Frontend_Adapter SHALL replace `window.electron` API calls with `@tauri-apps/api` equivalents
2. WHEN adapting the frontend THEN the Frontend_Adapter SHALL preserve all existing manager modules (editor-manager, note-manager, ui-manager, shortcut-manager)
3. WHEN adapting the frontend THEN the Frontend_Adapter SHALL preserve all HTML structure and CSS styling

### Requirement 21: Build Configuration

**User Story:** As a developer, I want proper build configuration for all target platforms, so that I can distribute the application.

#### Acceptance Criteria

1. WHEN building for Windows THEN the Build_System SHALL produce NSIS installer and portable executable
2. WHEN building for macOS THEN the Build_System SHALL produce DMG bundle and register as .md file handler
3. WHEN building for Linux THEN the Build_System SHALL produce AppImage and DEB packages with desktop file for .md association

### Requirement 22: Event Communication

**User Story:** As a developer, I want the backend to send events to the frontend, so that the UI can react to system events.

#### Acceptance Criteria

1. WHEN a note is created externally (clipboard capture, quick note) THEN the Event_Emitter SHALL emit a refresh-notes event to the frontend
2. WHEN a file is opened via command line or file association THEN the Event_Emitter SHALL emit an open-file event with the file path

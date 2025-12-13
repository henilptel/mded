import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap, KeyBinding } from '@codemirror/view';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap, undo, redo, insertNewlineAndIndent } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { marked } from 'marked';

// Lazy-loaded highlight.js module
type HLJSApi = typeof import('highlight.js').default;
let hljsModule: HLJSApi | null = null;
let hljsLoadPromise: Promise<HLJSApi> | null = null;

/**
 * Lazily load highlight.js only when needed (code-splitting)
 * This reduces initial bundle size significantly (~500KB savings)
 */
async function loadHighlightJS(): Promise<HLJSApi> {
  if (hljsModule) return hljsModule;
  if (hljsLoadPromise) return hljsLoadPromise;
  
  hljsLoadPromise = import('highlight.js').then(mod => {
    hljsModule = mod.default;
    return hljsModule;
  });
  
  return hljsLoadPromise;
}

/**
 * EditorManager class using CodeMirror 6
 * Maintains the same public API as the original textarea-based implementation
 */
export class EditorManager {
  private view: EditorView;
  private editorContainer: HTMLElement;
  private preview: HTMLDivElement;
  private modeLabel: HTMLSpanElement;
  
  public isPreviewMode = false;
  
  public onInput: (() => void) | null = null;
  public onSave: (() => void) | null = null;
  public onStatsUpdate: ((completed: number, total: number) => void) | null = null;

  private fontSize: number = 16;
  private originalContent: string = '';
  
  // Compartment for dynamic font size reconfiguration
  private fontSizeCompartment: Compartment;
  
  // Debounce timer for preview updates on large documents
  private previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Threshold for debouncing (characters)
  private static readonly LARGE_DOC_THRESHOLD = 5000;
  // Debounce delay for large documents (ms)
  private static readonly DEBOUNCE_DELAY = 150;

  constructor(
    editorContainer: HTMLElement,
    previewEl: HTMLDivElement,
    modeLabelEl: HTMLSpanElement
  ) {
    this.editorContainer = editorContainer;
    this.preview = previewEl;
    this.modeLabel = modeLabelEl;
    
    // Initialize compartment for font size
    this.fontSizeCompartment = new Compartment();

    // Create CodeMirror extensions
    const extensions = this.createExtensions();

    // Create initial state
    const state = EditorState.create({
      doc: '',
      extensions
    });

    // Create the EditorView
    this.view = new EditorView({
      state,
      parent: this.editorContainer
    });

    // Set initial font size
    this.applyFontSize();
  }


  /**
   * Create CodeMirror extensions for the editor
   */
  private createExtensions(): Extension[] {
    return [
      // Line numbers in gutter
      lineNumbers(),
      
      // Highlight active line
      highlightActiveLine(),
      highlightActiveLineGutter(),
      
      // Bracket matching
      bracketMatching(),
      
      // History for undo/redo (maintains 100+ operations)
      history(),
      
      // Markdown language support with syntax highlighting
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(defaultHighlightStyle),
      
      // Custom keymap for list continuation (must come before defaultKeymap)
      keymap.of(this.createListContinuationKeymap()),
      
      // Auto-pairing for brackets and quotes
      this.createAutoPairingExtension(),
      
      // Paste handler for images and terminal output
      this.createPasteHandlerExtension(),
      
      // Default keybindings including undo/redo
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap
      ]),
      
      // Update listener for content changes
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.onInput?.();
          this.updatePreview();
        }
      }),
      
      // Font size theme (in compartment for dynamic updates)
      this.fontSizeCompartment.of(this.createFontSizeTheme()),
      
      // Base theme for font family
      EditorView.theme({
        '.cm-content': {
          fontFamily: 'inherit'
        }
      })
    ];
  }
  
  /**
   * Create font size theme extension
   */
  private createFontSizeTheme(): Extension {
    return EditorView.theme({
      '&': {
        fontSize: `${this.fontSize}px`
      },
      '.cm-gutters': {
        fontSize: `${this.fontSize}px`
      }
    });
  }

  /**
   * Create keymap for list continuation on Enter
   */
  private createListContinuationKeymap(): KeyBinding[] {
    return [
      {
        key: 'Enter',
        run: (view: EditorView): boolean => {
          const state = view.state;
          const selection = state.selection.main;
          const line = state.doc.lineAt(selection.from);
          const lineText = line.text;
          
          // Patterns for list items
          const bulletPattern = /^(\s*)([-*+])\s(.*)$/;
          const numberPattern = /^(\s*)(\d+)\.\s(.*)$/;
          const checkboxPattern = /^(\s*)([-*+])\s\[[ xX]\]\s(.*)$/;
          
          // Check for checkbox first (more specific)
          let match = lineText.match(checkboxPattern);
          if (match) {
            const indent = match[1] ?? '';
            const bullet = match[2] ?? '-';
            const content = match[3] ?? '';
            if (content.trim() === '') {
              // Empty checkbox item - remove the marker and exit list
              view.dispatch({
                changes: { from: line.from, to: line.to, insert: '' }
              });
              return true;
            }
            // Continue with unchecked checkbox
            const newLine = `\n${indent}${bullet} [ ] `;
            view.dispatch({
              changes: { from: selection.from, to: selection.from, insert: newLine },
              selection: { anchor: selection.from + newLine.length }
            });
            return true;
          }
          
          // Check for numbered list
          match = lineText.match(numberPattern);
          if (match) {
            const indent = match[1] ?? '';
            const num = match[2] ?? '1';
            const content = match[3] ?? '';
            if (content.trim() === '') {
              // Empty numbered item - remove the marker and exit list
              view.dispatch({
                changes: { from: line.from, to: line.to, insert: '' }
              });
              return true;
            }
            // Continue with next number
            const nextNum = parseInt(num, 10) + 1;
            const newLine = `\n${indent}${nextNum}. `;
            view.dispatch({
              changes: { from: selection.from, to: selection.from, insert: newLine },
              selection: { anchor: selection.from + newLine.length }
            });
            return true;
          }
          
          // Check for bullet list
          match = lineText.match(bulletPattern);
          if (match) {
            const indent = match[1] ?? '';
            const bullet = match[2] ?? '-';
            const content = match[3] ?? '';
            if (content.trim() === '') {
              // Empty bullet item - remove the marker and exit list
              view.dispatch({
                changes: { from: line.from, to: line.to, insert: '' }
              });
              return true;
            }
            // Continue with same bullet
            const newLine = `\n${indent}${bullet} `;
            view.dispatch({
              changes: { from: selection.from, to: selection.from, insert: newLine },
              selection: { anchor: selection.from + newLine.length }
            });
            return true;
          }
          
          // No list pattern - use default behavior
          return insertNewlineAndIndent(view);
        }
      }
    ];
  }

  /**
   * Create extension for auto-pairing brackets and quotes
   * Handles: ( [ { * ` " '
   * Wraps selection if text is selected
   */
  private createAutoPairingExtension(): Extension {
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '*': '*',
      '`': '`',
      '"': '"',
      "'": "'"
    };

    return EditorView.inputHandler.of((view, from, to, text) => {
      // Only handle single character inputs that are in our pairs
      if (text.length !== 1 || !(text in pairs)) {
        return false;
      }

      const closing = pairs[text];
      const state = view.state;
      const selection = state.selection.main;

      // If there's a selection, wrap it
      if (selection.from !== selection.to) {
        const selectedText = state.sliceDoc(selection.from, selection.to);
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text + selectedText + closing },
          selection: { anchor: selection.from + 1, head: selection.from + 1 + selectedText.length }
        });
        return true;
      }

      // No selection - insert pair and place cursor between
      view.dispatch({
        changes: { from, to, insert: text + closing },
        selection: { anchor: from + 1 }
      });
      return true;
    });
  }

  /**
   * Create paste handler extension for images and terminal output
   * Handles: image paste (saves via electron API), terminal output detection
   */
  private createPasteHandlerExtension(): Extension {
    return EditorView.domEventHandlers({
      paste: (event: ClipboardEvent, view: EditorView) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const items = clipboardData.items;
        
        // Check for image data first
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item) continue;
          
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            
            const file = item.getAsFile();
            if (!file) continue;

            const reader = new FileReader();
            reader.onerror = () => {
              console.error('Failed to read pasted image');
            };
            reader.onload = async () => {
              try {
                if (typeof window === 'undefined' || !window.electron) {
                  console.error('Cannot save screenshot: electron API not available');
                  return;
                }
                const base64Data = reader.result as string;
                const result = await window.electron.saveScreenshot(base64Data);
                
                if (result.success && result.imagePath) {
                  const markdownImg = `![screenshot](${result.imagePath})\n`;
                  const pos = view.state.selection.main.from;
                  view.dispatch({
                    changes: { from: pos, to: pos, insert: markdownImg },
                    selection: { anchor: pos + markdownImg.length }
                  });
                  this.updatePreview();
                  this.onInput?.();
                } else {
                  console.error('Failed to save screenshot:', result.error);
                }
              } catch (err) {
                console.error('Failed to save screenshot:', err);
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }

        // Check for terminal output in text
        const text = clipboardData.getData('text/plain');
        if (text && this.isTerminalOutput(text)) {
          event.preventDefault();
          const formattedOutput = this.formatTerminalOutput(text);
          const selection = view.state.selection.main;
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: formattedOutput },
            selection: { anchor: selection.from + formattedOutput.length }
          });
          this.updatePreview();
          this.onInput?.();
          return true;
        }

        return false;
      }
    });
  }

  /**
   * Detect if text looks like terminal output
   */
  private isTerminalOutput(text: string): boolean {
    const lines = text.split('\n');
    if (lines.length < 2) return false;

    // Early check: if first non-empty line is a Markdown header, not terminal output
    const firstNonEmpty = lines.find(l => l.trim().length > 0)?.trim() || '';
    const isMarkdownHeader = /^#{1,6}\s+\S/.test(firstNonEmpty);

    const terminalPatterns = [
      /^\$\s+\S+/,
      /^>\s+\S+/,
      /^%\s+\S+/,
      /^#\s+\S+/,
      /^\[\w+[@:]/,
      /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+[:\$#%]/,
      /^(npm|yarn|pnpm|node|python|pip|cargo|go|git|docker|kubectl)\s+(ERR!|WARN|error|warning)/i,
      /^(Error|ERROR|Warning|WARNING|FAIL|PASSED|FAILED):/,
      /^\s*(at\s+\S+\s+\([^)]+\))/,
      /^Traceback \(most recent call last\)/,
      /^>>>?\s+/,
      /^In \[\d+\]:/,
    ];

    const hasPromptLine = lines.some(line => 
      terminalPatterns.slice(0, 6).some(pattern => pattern.test(line.trim()))
    );
    
    const hasErrorPattern = lines.some(line => 
      terminalPatterns.slice(6).some(pattern => pattern.test(line.trim()))
    );

    // If it looks like a Markdown header and no error patterns, exclude it
    if (isMarkdownHeader && !hasErrorPattern) return false;

    if (hasPromptLine || hasErrorPattern) return true;

    const hasIndentedOutput = lines.filter(l => l.startsWith('  ') || l.startsWith('\t')).length > lines.length * 0.3;
    const hasAnsiCodes = /\x1b\[[0-9;]*m/.test(text);
    
    return hasIndentedOutput || hasAnsiCodes;
  }

  /**
   * Format terminal output as a markdown code block
   */
  private formatTerminalOutput(text: string): string {
    const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
    
    const lines = cleanText.split('\n');
    const firstLine = (lines[0] ?? '').trim();
    
    const promptPatterns = [
      /^\$\s+(.+)$/,
      /^>\s+(.+)$/,
      /^%\s+(.+)$/,
      /^#\s+(.+)$/,
      /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+[:\$#%]\s*(.+)$/,
    ];
    
    let command = '';
    for (const pattern of promptPatterns) {
      const match = firstLine.match(pattern);
      if (match && match[1]) {
        command = match[1];
        break;
      }
    }
    
    if (command) {
      const output = lines.slice(1).join('\n').trim();
      return `\`\`\`bash\n$ ${command}\n${output}\n\`\`\`\n`;
    }
    
    return `\`\`\`\n${cleanText.trim()}\n\`\`\`\n`;
  }

  /**
   * Apply font size to editor and preview
   */
  private applyFontSize(): void {
    this.preview.style.fontSize = `${this.fontSize}px`;
    // CodeMirror font size is handled via theme extension
  }

  /**
   * Get the current document content
   */
  getContent(): string {
    return this.view.state.doc.toString();
  }

  /**
   * Set the document content
   */
  setContent(content: string): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content
      }
    });
    this.originalContent = content;
    this.updatePreview();
  }

  /**
   * Check if content has changed from original
   */
  isContentChanged(): boolean {
    return this.getContent() !== this.originalContent;
  }

  /**
   * Clear the editor content
   */
  clear(): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: ''
      }
    });
    this.originalContent = '';
    this.preview.innerHTML = '';
  }

  /**
   * Focus the editor
   */
  focus(): void {
    this.view.focus();
  }

  /**
   * Perform undo operation
   */
  undo(): boolean {
    return undo(this.view);
  }

  /**
   * Perform redo operation
   */
  redo(): boolean {
    return redo(this.view);
  }

  /**
   * Toggle between edit and preview modes
   */
  togglePreview(): void {
    this.isPreviewMode = !this.isPreviewMode;
    
    if (this.isPreviewMode) {
      // Hide CodeMirror, show preview
      this.editorContainer.classList.add('preview-mode');
      this.preview.classList.add('preview-mode');
      this.modeLabel.textContent = 'Edit';
      this.updatePreview();
    } else {
      // Show CodeMirror, hide preview
      this.editorContainer.classList.remove('preview-mode');
      this.preview.classList.remove('preview-mode');
      this.modeLabel.textContent = 'Preview';
    }
  }

  /**
   * Update the preview pane with rendered markdown
   * Uses debouncing for large documents (>5000 chars) to improve performance
   */
  updatePreview(): void {
    const content = this.getContent();
    
    // For large documents, debounce the preview update
    if (content.length > EditorManager.LARGE_DOC_THRESHOLD) {
      if (this.previewDebounceTimer) {
        clearTimeout(this.previewDebounceTimer);
      }
      this.previewDebounceTimer = setTimeout(() => {
        this.renderPreview(content);
        this.previewDebounceTimer = null;
      }, EditorManager.DEBOUNCE_DELAY);
    } else {
      // Small documents - update immediately
      if (this.previewDebounceTimer) {
        clearTimeout(this.previewDebounceTimer);
        this.previewDebounceTimer = null;
      }
      this.renderPreview(content);
    }
  }

  /**
   * Actually render the preview content
   * Separated from updatePreview for debouncing support
   */
  private renderPreview(markdownContent: string): void {
    // Configure marked to use GFM (GitHub Flavored Markdown) with task lists
    let html = marked.parse(markdownContent, { gfm: true, breaks: true }) as string;
    
    // Manually convert task list items to interactive checkboxes
    // Handle multiple possible formats from marked:
    // 1. <li>[ ] or <li>[x] (direct)
    // 2. <li><input ...> (if marked renders checkboxes)
    // 3. <li><p>[ ] (with paragraph wrapper)
    let checkboxIndex = 0;
    
    // Pattern 1: Direct checkbox syntax in li
    html = html.replace(
      /<li>(\s*)\[([ xX])\]/g, 
      (_, space, checked) => {
        const isChecked = checked.toLowerCase() === 'x';
        const checkbox = `<li class="task-list-item">${space}<input type="checkbox" data-checkbox-index="${checkboxIndex}" ${isChecked ? 'checked' : ''}> `;
        checkboxIndex++;
        return checkbox;
      }
    );
    
    // Pattern 2: Checkbox syntax inside paragraph in li
    html = html.replace(
      /<li><p>\[([ xX])\]/g, 
      (_, checked) => {
        const isChecked = checked.toLowerCase() === 'x';
        const checkbox = `<li class="task-list-item"><p><input type="checkbox" data-checkbox-index="${checkboxIndex}" ${isChecked ? 'checked' : ''}> `;
        checkboxIndex++;
        return checkbox;
      }
    );
    
    this.preview.innerHTML = html;
    
    // Post-process: find any existing checkboxes and add data attributes
    let existingIndex = checkboxIndex;
    this.preview.querySelectorAll('input[type="checkbox"]:not([data-checkbox-index])').forEach((cb) => {
      (cb as HTMLInputElement).dataset.checkboxIndex = String(existingIndex);
      (cb as HTMLInputElement).removeAttribute('disabled');
      existingIndex++;
    });
    
    // Apply syntax highlighting to code blocks (lazy-loaded)
    this.highlightCodeBlocks();

    this.updateStats();
  }

  /**
   * Apply syntax highlighting to code blocks
   * Lazily loads highlight.js only when code blocks are present
   */
  private async highlightCodeBlocks(): Promise<void> {
    const codeBlocks = this.preview.querySelectorAll('pre code');
    if (codeBlocks.length === 0) return;
    
    try {
      const hljs = await loadHighlightJS();
      codeBlocks.forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    } catch (err) {
      console.warn('Failed to load highlight.js:', err);
    }
  }

  updateStats(): void {
    const content = this.getContent();
    const total = (content.match(/- \[[ xX]\]/g) || []).length;
    const completed = (content.match(/- \[[xX]\]/g) || []).length;
    this.onStatsUpdate?.(completed, total);
  }

  /**
   * Toggle a checkbox at the given index in the document
   * @param index The index of the checkbox to toggle (0-based)
   */
  toggleCheckbox(index: number): void {
    const regex = /- \[[ xX]\]/g;
    const content = this.getContent();
    let match;
    let current = 0;
    
    while ((match = regex.exec(content)) !== null) {
      if (current === index) {
        const isChecked = match[0].includes('x') || match[0].includes('X');
        const newStr = isChecked ? '- [ ]' : '- [x]';
        
        // Dispatch transaction to update only the checkbox position
        this.view.dispatch({
          changes: {
            from: match.index,
            to: match.index + match[0].length,
            insert: newStr
          }
        });
        
        this.updatePreview();
        this.onInput?.();
        return;
      }
      current++;
    }
  }

  /**
   * Change the font size by a delta amount
   * Clamps to min/max bounds (10-32px)
   * @param delta The amount to change font size by (positive or negative)
   */
  changeFontSize(delta: number): void {
    // Clamp font size to 10-32px range
    this.fontSize = Math.max(10, Math.min(32, this.fontSize + delta));
    
    // Update CodeMirror theme via compartment reconfiguration
    this.view.dispatch({
      effects: this.fontSizeCompartment.reconfigure(this.createFontSizeTheme())
    });
    
    // Update preview div font size
    this.preview.style.fontSize = `${this.fontSize}px`;
  }

  /**
   * Insert markdown formatting around the current selection
   * If text is selected and already wrapped with markers, toggle them off
   * Otherwise, wrap selection or insert markers at cursor
   * @param before The opening marker (e.g., '**' for bold)
   * @param after The closing marker (defaults to same as before)
   */
  insertMarkdown(before: string, after?: string): void {
    const closingMarker = after ?? before;
    const state = this.view.state;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);
    
    // Check if selection is already wrapped with the markers
    const isWrapped = selectedText.startsWith(before) && selectedText.endsWith(closingMarker);
    
    // Also check if the surrounding text has the markers (for toggling off)
    const beforeStart = Math.max(0, selection.from - before.length);
    const afterEnd = Math.min(state.doc.length, selection.to + closingMarker.length);
    const textBefore = state.sliceDoc(beforeStart, selection.from);
    const textAfter = state.sliceDoc(selection.to, afterEnd);
    const isSurrounded = textBefore === before && textAfter === closingMarker;
    
    if (isWrapped) {
      // Remove markers from inside selection
      const unwrapped = selectedText.slice(before.length, selectedText.length - closingMarker.length);
      this.view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: unwrapped },
        selection: { anchor: selection.from, head: selection.from + unwrapped.length }
      });
    } else if (isSurrounded) {
      // Remove markers from around selection
      this.view.dispatch({
        changes: [
          { from: beforeStart, to: selection.from, insert: '' },
          { from: selection.to, to: afterEnd, insert: '' }
        ],
        selection: { anchor: beforeStart, head: beforeStart + selectedText.length }
      });
    } else if (selectedText.length > 0) {
      // Wrap selection with markers
      const wrapped = before + selectedText + closingMarker;
      this.view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: wrapped },
        selection: { anchor: selection.from, head: selection.from + wrapped.length }
      });
    } else {
      // No selection - insert markers and place cursor between them
      const inserted = before + closingMarker;
      this.view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: inserted },
        selection: { anchor: selection.from + before.length }
      });
    }
  }

  /**
   * Insert or toggle a line prefix (headers, quotes, etc.)
   * @param prefix The line prefix to insert/toggle (e.g., '# ', '> ')
   */
  insertLineMarkdown(prefix: string): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);
    const lineText = line.text;
    
    // Check if line already starts with this prefix
    if (lineText.startsWith(prefix)) {
      // Remove the prefix
      this.view.dispatch({
        changes: { from: line.from, to: line.from + prefix.length, insert: '' }
      });
    } else {
      // Check if it's a header prefix and line has a different header level
      const headerMatch = prefix.match(/^(#+)\s$/);
      if (headerMatch) {
        const existingHeaderMatch = lineText.match(/^(#+)\s/);
        if (existingHeaderMatch) {
          // Replace existing header with new level
          this.view.dispatch({
            changes: { from: line.from, to: line.from + existingHeaderMatch[0].length, insert: prefix }
          });
          return;
        }
      }
      
      // Check if it's a quote prefix and line already has one
      if (prefix === '> ' && lineText.startsWith('> ')) {
        // Remove the quote prefix
        this.view.dispatch({
          changes: { from: line.from, to: line.from + 2, insert: '' }
        });
        return;
      }
      
      // Add the prefix at the start of the line
      this.view.dispatch({
        changes: { from: line.from, to: line.from, insert: prefix }
      });
    }
  }

  /**
   * Duplicate the current line
   * Uses CodeMirror transaction for undoable operation
   */
  duplicateLine(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);
    const lineText = line.text;
    
    // Insert a newline followed by the line content after the current line
    this.view.dispatch({
      changes: { from: line.to, to: line.to, insert: '\n' + lineText },
      selection: { anchor: line.to + 1 + (selection.from - line.from) }
    });
  }

  /**
   * Delete the current line
   * Uses CodeMirror transaction for undoable operation
   */
  deleteCurrentLine(): void {
    const state = this.view.state;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);
    
    // Determine what to delete: include the newline character
    let from = line.from;
    let to = line.to;
    
    if (line.number < state.doc.lines) {
      // Not the last line - delete including the trailing newline
      to = line.to + 1;
    } else if (line.number > 1) {
      // Last line - delete including the preceding newline
      from = line.from - 1;
    }
    
    this.view.dispatch({
      changes: { from, to, insert: '' }
    });
  }
}

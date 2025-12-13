export class EditorManager {
  private editor: HTMLTextAreaElement;
  private preview: HTMLDivElement;
  private modeLabel: HTMLSpanElement;
  
  public isPreviewMode = false;
  
  public onInput: (() => void) | null = null;
  public onSave: (() => void) | null = null;
  public onStatsUpdate: ((completed: number, total: number) => void) | null = null;

  private fontSize: number = 16;

  private originalContent: string = '';

  constructor(editorEl: HTMLTextAreaElement, previewEl: HTMLDivElement, modeLabelEl: HTMLSpanElement) {
    this.editor = editorEl;
    this.preview = previewEl;
    this.modeLabel = modeLabelEl;

    // Set initial font size
    this.editor.style.fontSize = `${this.fontSize}px`;
    this.preview.style.fontSize = `${this.fontSize}px`;
    
    this.initEvents();
  }

  getContent(): string {
    return this.editor.value;
  }

  setContent(content: string) {
    this.editor.value = content;
    this.originalContent = content; // Track original
    this.updatePreview();
  }

  isContentChanged(): boolean {
      return this.editor.value !== this.originalContent;
  }

  clear() {
    this.editor.value = '';
    this.originalContent = '';
    this.preview.innerHTML = '';
  }

  focus() {
    this.editor.focus();
  }

  togglePreview() {
    this.isPreviewMode = !this.isPreviewMode;
    
    if (this.isPreviewMode) {
      this.editor.classList.add('preview-mode');
      this.preview.classList.add('preview-mode');
      this.modeLabel.textContent = 'Edit';
    } else {
      this.editor.classList.remove('preview-mode');
      this.preview.classList.remove('preview-mode');
      this.modeLabel.textContent = 'Preview';
    }
  }

  updatePreview() {
    const markdown = this.editor.value;
    // Configure marked to use GFM (GitHub Flavored Markdown) with task lists
    let html = marked.parse(markdown, { gfm: true, breaks: true });
    
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
    
    // Pattern 3: If marked already rendered input elements, ensure they have our data attribute
    // and are not disabled
    this.preview.innerHTML = html;
    
    // Post-process: find any existing checkboxes and add data attributes
    let existingIndex = checkboxIndex;
    this.preview.querySelectorAll('input[type="checkbox"]:not([data-checkbox-index])').forEach((cb) => {
      (cb as HTMLInputElement).dataset.checkboxIndex = String(existingIndex);
      (cb as HTMLInputElement).removeAttribute('disabled');
      existingIndex++;
    });
    
    this.preview.querySelectorAll('pre code').forEach((block) => {
      if (typeof hljs !== 'undefined') {
        hljs.highlightElement(block as HTMLElement);
      }
    });

    this.updateStats();
  }

  updateStats() {
      const markdown = this.editor.value;
      const total = (markdown.match(/- \[[ xX]\]/g) || []).length;
      const completed = (markdown.match(/- \[[xX]\]/g) || []).length;
      this.onStatsUpdate?.(completed, total);
  }

  toggleCheckbox(index: number) {
      const regex = /- \[[ xX]\]/g;
      const content = this.editor.value;
      let match;
      let current = 0;
      
      while ((match = regex.exec(content)) !== null) {
          if (current === index) {
              const isChecked = match[0].includes('x') || match[0].includes('X');
              const newStr = isChecked ? '- [ ]' : '- [x]';
              
              // Directly modify the editor value instead of using execCommand
              // This works even when the editor is hidden (in preview mode)
              const before = content.substring(0, match.index);
              const after = content.substring(match.index + match[0].length);
              this.editor.value = before + newStr + after;
              
              this.updatePreview();
              this.onInput?.();
              return;
          }
          current++;
      }
  }

  changeFontSize(delta: number) {
      this.fontSize = Math.max(10, Math.min(32, this.fontSize + delta));
      this.editor.style.fontSize = `${this.fontSize}px`;
      this.preview.style.fontSize = `${this.fontSize}px`;
  }

  insertMarkdown(before: string, after: string = '') {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const content = this.editor.value;
    const selectedText = content.substring(start, end);
    
    this.editor.focus();
    
    // Check if we should toggle off (text is already wrapped with before/after)
    const beforeLen = before.length;
    const afterLen = after.length;
    
    // Check if selection is already wrapped
    const textBefore = content.substring(Math.max(0, start - beforeLen), start);
    const textAfter = content.substring(end, end + afterLen);
    
    if (textBefore === before && textAfter === after) {
      // Remove the wrapping - select including the markers
      this.editor.setSelectionRange(start - beforeLen, end + afterLen);
      document.execCommand('insertText', false, selectedText);
      // Position cursor to select the unwrapped text
      this.editor.selectionStart = start - beforeLen;
      this.editor.selectionEnd = start - beforeLen + selectedText.length;
    } else {
      // Add the wrapping
      const newText = before + selectedText + after;
      this.editor.setSelectionRange(start, end);
      document.execCommand('insertText', false, newText);
      // Position cursor inside the inserted text
      this.editor.selectionStart = start + beforeLen;
      this.editor.selectionEnd = start + beforeLen + selectedText.length;
    }
    
    this.updatePreview();
    this.onInput?.();
  }

  insertLineMarkdown(prefix: string) {
    const start = this.editor.selectionStart;
    const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = this.editor.value.indexOf('\n', start);
    const end = lineEnd === -1 ? this.editor.value.length : lineEnd;
    
    const line = this.editor.value.substring(lineStart, end);
    const newLine = line.startsWith(prefix) ? line.substring(prefix.length) : prefix + line;
    
    this.editor.focus();
    this.editor.setSelectionRange(lineStart, end);
    document.execCommand('insertText', false, newLine);
    
    this.updatePreview();
    this.onInput?.();
  }


  duplicateLine() {
    const start = this.editor.selectionStart;
    const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = this.editor.value.indexOf('\n', start);
    const end = lineEnd === -1 ? this.editor.value.length : lineEnd;
    
    // Get current line content
    const line = this.editor.value.substring(lineStart, end);
    const insertContent = '\n' + line;
    
    // Use execCommand to insert text so it's undoable
    this.editor.focus();
    this.editor.setSelectionRange(end, end);
    document.execCommand('insertText', false, insertContent);
    
    // Move cursor to the new line
    const column = start - lineStart;
    const newStart = end + 1 + column;
    this.editor.setSelectionRange(newStart, newStart);
    
    this.updatePreview();
    this.onInput?.();
  }

  deleteCurrentLine() {
    const start = this.editor.selectionStart;
    const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = this.editor.value.indexOf('\n', start);
    
    if (lineEnd === -1) {
        lineEnd = this.editor.value.length;
    } else {
        lineEnd += 1; // Include newline
    }
    
    this.editor.focus();
    this.editor.setSelectionRange(lineStart, lineEnd);
    document.execCommand('delete');
    
    this.updatePreview();
    this.onInput?.();
  }

  private initEvents() {
    this.editor.addEventListener('input', () => {
      this.updatePreview();
      this.onInput?.();
    });

    this.editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
            this.handleTab(e);
        } else if (e.key === 'Enter') {
            this.handleEnter(e);
        } else if (['(', '[', '{', '*', '`', '"', "'"].includes(e.key)) {
            this.handleAutoPair(e);
        }
    });

    this.editor.addEventListener('paste', (e) => {
        this.handlePaste(e);
    });

    // Delegated click listener for checkboxes
    this.preview.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        
        // Check if clicked element is a checkbox
        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
            e.preventDefault();
            e.stopPropagation();
            
            const checkbox = target as HTMLInputElement;
            
            // Use data attribute if available, otherwise fall back to index search
            const indexAttr = checkbox.dataset.checkboxIndex;
            let index = -1;
            
            if (indexAttr !== undefined && indexAttr !== '') {
                index = parseInt(indexAttr, 10);
            } else {
                const checkboxes = this.preview.querySelectorAll('input[type="checkbox"]');
                index = Array.from(checkboxes).indexOf(checkbox);
            }
            
            if (index >= 0 && !isNaN(index)) {
                this.toggleCheckbox(index);
            }
        }
    });
  }

  private handleTab(e: KeyboardEvent) {
      e.preventDefault();
      const start = this.editor.selectionStart;
      const end = this.editor.selectionEnd;

      if (start !== end) {
          // Multi-line indentation not implemented yet for simplicity, just indenting overwrite? 
          // Reverting to simple space insertion for now as per plan MVP
          document.execCommand('insertText', false, '  ');
      } else {
          document.execCommand('insertText', false, '  ');
      }
  }

  private handleEnter(e: KeyboardEvent) {
      const start = this.editor.selectionStart;
      const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
      const lineContent = this.editor.value.substring(lineStart, start); // Text before cursor
      
      // Improved regex to handle variable spacing and ensure robust matching.
      // Matches: "- [ ]", "- [x]", "1. ", "- ", "* "
      // CRITICAL: Task markers (- [ ]) must be checked BEFORE generic bullets (- ) because (- ) is a prefix of (- [ ]).
      const match = lineContent.match(/^(\s*)(- \[\s*[xX]?\s*\]\s*|[0-9]+\.\s*|[-*]\s*)(.*)/);

      if (match) {
          const [, leadingSpaces = '', marker = '', rest = ''] = match;
          
          if (!rest.trim()) {
              // Empty list item -> Exit list
              e.preventDefault();
              // Remove the specific line content using execCommand
              this.editor.setSelectionRange(lineStart, start);
              document.execCommand('delete');
          } else {
              // Continue list
              e.preventDefault();
              
              // Determine next marker
              let nextMarker = marker;
              if (/^[0-9]+\./.test(marker)) {
                   // Increment number (e.g. "1. " -> "2. ")
                   const num = parseInt(marker, 10);
                   if (!isNaN(num)) {
                       nextMarker = `${num + 1}. `;
                   }
              } else if (marker.includes('[') && marker.includes(']')) {
                  // Always use unchecked box for new item
                  nextMarker = '- [ ] ';
              } // else it's "- " or "* " - keep as is

              document.execCommand('insertText', false, '\n' + leadingSpaces + nextMarker);
          }
      }
  }

  private handleAutoPair(e: KeyboardEvent) {
      const pairs: Record<string, string> = {
          '(': ')', '[': ']', '{': '}',
          '*': '*', '`': '`', '"': '"', "'": "'"
      };
      
      const char = e.key;
      const close = pairs[char];
      if (!close) return;

      const start = this.editor.selectionStart;
      const end = this.editor.selectionEnd;
      const hasSelection = start !== end;
      
      e.preventDefault();
      
      if (hasSelection) {
          const selection = this.editor.value.substring(start, end);
          document.execCommand('insertText', false, char + selection + close);
          // Re-select content
          // This might lose selection range logic due to how execCommand works, but typically places cursor at end
          // Let's manually restore selection? 
          // execCommand usually places cursor at end of inserted text.
      } else {
          const originalIndex = this.editor.selectionStart;
          document.execCommand('insertText', false, char + close);
          // Set caret between the pair (no selection)
          this.editor.selectionStart = originalIndex + 1;
          this.editor.selectionEnd = originalIndex + 1;
      }
      
      this.onInput?.();
      this.updatePreview();
  }

  private async handlePaste(e: ClipboardEvent) {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item) continue;
          
          if (item.type.startsWith('image/')) {
              e.preventDefault();
              
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
                          document.execCommand('insertText', false, markdownImg);
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
              return;
          }
      }

      const text = clipboardData.getData('text/plain');
      if (text && this.isTerminalOutput(text)) {
          e.preventDefault();
          const formattedOutput = this.formatTerminalOutput(text);
          document.execCommand('insertText', false, formattedOutput);
          this.updatePreview();
          this.onInput?.();
      }
  }

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
}
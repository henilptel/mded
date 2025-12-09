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
    const html = marked.parse(markdown);
    this.preview.innerHTML = html;
    
    this.preview.querySelectorAll('pre code').forEach((block) => {
      if (typeof hljs !== 'undefined') {
        hljs.highlightElement(block as HTMLElement);
      }
    });

    // Interactive Checkboxes
    this.preview.querySelectorAll('input[type="checkbox"]').forEach((checkbox, index) => {
        // Enable the checkbox so it can capture clicks
        checkbox.removeAttribute('disabled');
        checkbox.addEventListener('click', (e) => {
            e.preventDefault(); // allow us to handle the toggle in markdown
            this.toggleCheckbox(index);
        });
    });

    this.updateStats();
  }

  updateStats() {
      const markdown = this.editor.value;
      const total = (markdown.match(/- \[[ x]\]/g) || []).length;
      const completed = (markdown.match(/- \[x\]/g) || []).length;
      this.onStatsUpdate?.(completed, total);
  }

  toggleCheckbox(index: number) {
      const regex = /- \[[ x]\]/g;
      const content = this.editor.value;
      let match;
      let current = 0;
      
      while ((match = regex.exec(content)) !== null) {
          if (current === index) {
              const isChecked = match[0] === '- [x]';
              const newStr = isChecked ? '- [ ]' : '- [x]';
              
              this.editor.value = content.substring(0, match.index) + 
                                  newStr + 
                                  content.substring(match.index + match[0].length);
              
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
    const selectedText = this.editor.value.substring(start, end);
    const newText = before + selectedText + after;
    
    this.editor.value = this.editor.value.substring(0, start) + newText + this.editor.value.substring(end);
    this.editor.focus();
    this.editor.selectionStart = start + before.length;
    this.editor.selectionEnd = start + before.length + selectedText.length;
    
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
    
    this.editor.value = this.editor.value.substring(0, lineStart) + newLine + this.editor.value.substring(end);
    this.editor.focus();
    
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
        if (e.key === 'Tab') {
            this.handleTab(e);
        } else if (e.key === 'Enter') {
            this.handleEnter(e);
        } else if (['(', '[', '{', '*', '`', '"', "'"].includes(e.key)) {
            this.handleAutoPair(e);
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
          const [full, leadingSpaces, marker, rest] = match;
          
          if (!rest.trim()) {
              // Empty list item -> Exit list
              e.preventDefault();
              // Remove the specific line content
              this.editor.setRangeText('', lineStart, start, 'end');
          } else {
              // Continue list
              e.preventDefault();
              
              // Determine next marker
              let nextMarker = marker;
              if (marker.match(/^[0-9]+\./)) {
                   // Increment number (e.g. "1. " -> "2. ")
                   const num = parseInt(marker);
                   if (!isNaN(num)) {
                       nextMarker = `${num + 1}. `;
                   }
              } else if (marker.includes('[') && marker.includes(']')) {
                  // Always use unchecked box for new item
                  nextMarker = '- [ ] ';
              } // else it's "- " or "* " - keep as is (but clean up spacing if needed? let's keep exact string to be safe)

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
          document.execCommand('insertText', false, char + close);
          // Move cursor back one
          this.editor.selectionStart = this.editor.selectionEnd - 1;
          this.editor.selectionEnd = this.editor.selectionEnd;
      }
      
      this.onInput?.();
      this.updatePreview();
  }
}

export class EditorManager {
  private editor: HTMLTextAreaElement;
  private preview: HTMLDivElement;
  private modeLabel: HTMLSpanElement;
  
  public isPreviewMode = false;
  
  public onInput: (() => void) | null = null;
  public onSave: (() => void) | null = null;

  constructor(editorEl: HTMLTextAreaElement, previewEl: HTMLDivElement, modeLabelEl: HTMLSpanElement) {
    this.editor = editorEl;
    this.preview = previewEl;
    this.modeLabel = modeLabelEl;
    
    this.initEvents();
  }

  getContent(): string {
    return this.editor.value;
  }

  setContent(content: string) {
    this.editor.value = content;
    this.updatePreview();
  }

  clear() {
    this.editor.value = '';
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
    
    // We want to insert a newline + the line content after the current line
    // If we are at the very end of file, we might need a preliminary newline if one doesn't exist
    const insertContent = '\n' + line;
    
    this.editor.value = this.editor.value.substring(0, end) + insertContent + this.editor.value.substring(end);
    
    // Move cursor to the new line, same column if possible
    const column = start - lineStart;
    const newStart = end + 1 + column;
    
    this.editor.selectionStart = newStart;
    this.editor.selectionEnd = newStart;
    
    this.editor.focus();
    this.updatePreview();
    this.onInput?.();
  }

  deleteCurrentLine() {
    const start = this.editor.selectionStart;
    const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = this.editor.value.indexOf('\n', start);
    
    // If last line (no newline found), set to length
    if (lineEnd === -1) {
        lineEnd = this.editor.value.length;
    } else {
        // If not last line, include the newline character in deletion so the line actually disappears
        lineEnd += 1;
    }
    
    // Deleting everything from lineStart to lineEnd
    this.editor.value = this.editor.value.substring(0, lineStart) + this.editor.value.substring(lineEnd);
    
    // Move cursor to lineStart (which is now the start of the *next* line, or same position)
    this.editor.selectionStart = lineStart;
    this.editor.selectionEnd = lineStart;
    
    this.editor.focus();
    this.updatePreview();
    this.onInput?.();
  }

  private initEvents() {
    this.editor.addEventListener('input', () => {
      this.updatePreview();
      this.onInput?.();
    });
  }
}

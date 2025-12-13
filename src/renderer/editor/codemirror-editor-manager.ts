import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap, undo, redo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';

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

  constructor(
    editorContainer: HTMLElement,
    previewEl: HTMLDivElement,
    modeLabelEl: HTMLSpanElement
  ) {
    this.editorContainer = editorContainer;
    this.preview = previewEl;
    this.modeLabel = modeLabelEl;

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
      
      // Base theme for font size
      EditorView.theme({
        '&': {
          fontSize: `${this.fontSize}px`
        },
        '.cm-content': {
          fontFamily: 'inherit'
        },
        '.cm-gutters': {
          fontSize: `${this.fontSize}px`
        }
      })
    ];
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

  // Placeholder methods for features to be implemented in later tasks
  togglePreview(): void {
    // TODO: Implement in task 4.1
  }

  updatePreview(): void {
    // TODO: Implement in task 4.1
    this.updateStats();
  }

  updateStats(): void {
    const content = this.getContent();
    const total = (content.match(/- \[[ xX]\]/g) || []).length;
    const completed = (content.match(/- \[[xX]\]/g) || []).length;
    this.onStatsUpdate?.(completed, total);
  }

  toggleCheckbox(_index: number): void {
    // TODO: Implement in task 4.2
  }

  changeFontSize(_delta: number): void {
    // TODO: Implement in task 7.3
  }

  insertMarkdown(_before: string, _after?: string): void {
    // TODO: Implement in task 6.1
  }

  insertLineMarkdown(_prefix: string): void {
    // TODO: Implement in task 6.2
  }

  duplicateLine(): void {
    // TODO: Implement in task 6.3
  }

  deleteCurrentLine(): void {
    // TODO: Implement in task 6.3
  }
}

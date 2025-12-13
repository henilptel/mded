import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EditorManager } from '../editor/codemirror-editor-manager';
import { Transaction } from '@codemirror/state';

/**
 * Property-based tests for EditorManager with CodeMirror 6
 * Tests validate correctness properties from the design document
 */

describe('EditorManager Property Tests', () => {
  let container: HTMLElement;
  let preview: HTMLDivElement;
  let modeLabel: HTMLSpanElement;
  let editor: EditorManager;

  beforeEach(() => {
    // Create DOM elements for testing
    container = document.createElement('div');
    container.id = 'editor-container';
    preview = document.createElement('div') as HTMLDivElement;
    preview.id = 'preview';
    modeLabel = document.createElement('span') as HTMLSpanElement;
    modeLabel.id = 'mode-label';
    
    document.body.appendChild(container);
    document.body.appendChild(preview);
    document.body.appendChild(modeLabel);
    
    editor = new EditorManager(container, preview, modeLabel);
  });

  afterEach(() => {
    // Cleanup DOM
    document.body.innerHTML = '';
  });

  /**
   * **Feature: codemirror-migration, Property 1: Content round-trip consistency**
   * *For any* valid string content, setting content via `setContent()` and 
   * immediately retrieving it via `getContent()` SHALL return an identical string.
   * **Validates: Requirements 5.1, 5.2, 5.3, 6.1, 6.2**
   */
  it('Property 1: Content round-trip consistency', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        editor.setContent(content);
        const retrieved = editor.getContent();
        return retrieved === content;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: codemirror-migration, Property 2: Undo restores previous state**
   * *For any* sequence of edit operations, performing an undo SHALL restore 
   * the document to its state before the most recent edit.
   * **Validates: Requirements 2.1, 2.4**
   */
  it('Property 2: Undo restores previous state', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }), // Ensure we have something to insert
        (initialContent, textToInsert) => {
          // Create a fresh editor for each test to ensure clean history
          const testContainer = document.createElement('div');
          const testPreview = document.createElement('div') as HTMLDivElement;
          const testModeLabel = document.createElement('span') as HTMLSpanElement;
          document.body.appendChild(testContainer);
          
          const testEditor = new EditorManager(testContainer, testPreview, testModeLabel);
          
          try {
            // Set initial content using setContent (this resets history, which is fine)
            testEditor.setContent(initialContent);
            const stateBeforeEdit = testEditor.getContent();
            
            // Make an edit by inserting text at the end using dispatch
            // This creates a new history entry
            const view = (testEditor as any).view;
            view.dispatch({
              changes: { from: view.state.doc.length, to: view.state.doc.length, insert: textToInsert },
              // Use userEvent annotation to ensure this is treated as a separate history event
              annotations: [Transaction.userEvent.of('input')]
            });
            
            // Verify content changed
            const stateAfterEdit = testEditor.getContent();
            const expectedAfterEdit = stateBeforeEdit + textToInsert;
            if (stateAfterEdit !== expectedAfterEdit) {
              return false; // Edit didn't work as expected
            }
            
            // Perform undo
            testEditor.undo();
            
            // Verify state is restored
            const stateAfterUndo = testEditor.getContent();
            return stateAfterUndo === stateBeforeEdit;
          } finally {
            document.body.removeChild(testContainer);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: codemirror-migration, Property 3: Redo restores undone state**
   * *For any* undo operation, performing a redo SHALL restore the document 
   * to its state before the undo was performed.
   * **Validates: Requirements 2.2**
   */
  it('Property 3: Redo restores undone state', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }), // Ensure we have something to insert
        (initialContent, textToInsert) => {
          // Create a fresh editor for each test to ensure clean history
          const testContainer = document.createElement('div');
          const testPreview = document.createElement('div') as HTMLDivElement;
          const testModeLabel = document.createElement('span') as HTMLSpanElement;
          document.body.appendChild(testContainer);
          
          const testEditor = new EditorManager(testContainer, testPreview, testModeLabel);
          
          try {
            // Set initial content
            testEditor.setContent(initialContent);
            
            // Make an edit by inserting text at the end
            const view = (testEditor as any).view;
            view.dispatch({
              changes: { from: view.state.doc.length, to: view.state.doc.length, insert: textToInsert },
              annotations: [Transaction.userEvent.of('input')]
            });
            
            // Capture state after edit
            const stateAfterEdit = testEditor.getContent();
            
            // Perform undo
            testEditor.undo();
            
            // Perform redo
            testEditor.redo();
            
            // Verify state is restored to after-edit state
            const stateAfterRedo = testEditor.getContent();
            return stateAfterRedo === stateAfterEdit;
          } finally {
            document.body.removeChild(testContainer);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: codemirror-migration, Property 4: Content change detection accuracy**
   * *For any* document state, `isContentChanged()` SHALL return true if and only if 
   * the current content differs from the content at the last `setContent()` call.
   * **Validates: Requirements 6.5**
   */
  it('Property 4: Content change detection accuracy', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (initialContent, newContent) => {
          // Create a fresh editor for each test
          const testContainer = document.createElement('div');
          const testPreview = document.createElement('div') as HTMLDivElement;
          const testModeLabel = document.createElement('span') as HTMLSpanElement;
          document.body.appendChild(testContainer);
          
          const testEditor = new EditorManager(testContainer, testPreview, testModeLabel);
          
          try {
            // Set initial content
            testEditor.setContent(initialContent);
            
            // After setContent, isContentChanged should be false
            if (testEditor.isContentChanged() !== false) {
              return false;
            }
            
            // Modify content via dispatch
            const view = (testEditor as any).view;
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: newContent }
            });
            
            // isContentChanged should reflect whether content differs from original
            const expectedChanged = newContent !== initialContent;
            return testEditor.isContentChanged() === expectedChanged;
          } finally {
            document.body.removeChild(testContainer);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: codemirror-migration, Property 5: Checkbox toggle correctness**
   * *For any* document containing task list items, toggling checkbox at index N 
   * SHALL change only the Nth checkbox marker between `[ ]` and `[x]`, 
   * leaving all other content unchanged.
   * **Validates: Requirements 4.2**
   */
  it('Property 5: Checkbox toggle correctness', () => {
    // Generator for task list items
    const taskItemGen = fc.record({
      checked: fc.boolean(),
      text: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('[') && !s.includes(']') && !s.includes('\n'))
    });

    // Generator for documents with task lists
    const documentWithTasksGen = fc.array(taskItemGen, { minLength: 1, maxLength: 10 }).map(items => {
      return items.map(item => {
        const checkbox = item.checked ? '- [x]' : '- [ ]';
        return `${checkbox} ${item.text}`;
      }).join('\n');
    });

    fc.assert(
      fc.property(
        documentWithTasksGen,
        fc.nat(), // Index to toggle
        (docContent, indexSeed) => {
          // Create a fresh editor for each test
          const testContainer = document.createElement('div');
          const testPreview = document.createElement('div') as HTMLDivElement;
          const testModeLabel = document.createElement('span') as HTMLSpanElement;
          document.body.appendChild(testContainer);
          
          const testEditor = new EditorManager(testContainer, testPreview, testModeLabel);
          
          try {
            // Set content
            testEditor.setContent(docContent);
            
            // Count checkboxes
            const checkboxMatches = docContent.match(/- \[[ xX]\]/g) || [];
            const numCheckboxes = checkboxMatches.length;
            
            if (numCheckboxes === 0) {
              return true; // No checkboxes to toggle
            }
            
            // Pick a valid index
            const index = indexSeed % numCheckboxes;
            
            // Get state before toggle
            const contentBefore = testEditor.getContent();
            
            // Find the Nth checkbox
            const regex = /- \[[ xX]\]/g;
            let match;
            let current = 0;
            let targetMatch: RegExpExecArray | null = null;
            
            while ((match = regex.exec(contentBefore)) !== null) {
              if (current === index) {
                targetMatch = match;
                break;
              }
              current++;
            }
            
            if (!targetMatch) {
              return true; // Shouldn't happen, but safe guard
            }
            
            const wasChecked = targetMatch[0].includes('x') || targetMatch[0].includes('X');
            
            // Toggle the checkbox
            testEditor.toggleCheckbox(index);
            
            // Get state after toggle
            const contentAfter = testEditor.getContent();
            
            // Verify only the target checkbox changed
            const expectedNewCheckbox = wasChecked ? '- [ ]' : '- [x]';
            const expectedContent = 
              contentBefore.substring(0, targetMatch.index) + 
              expectedNewCheckbox + 
              contentBefore.substring(targetMatch.index + targetMatch[0].length);
            
            return contentAfter === expectedContent;
          } finally {
            document.body.removeChild(testContainer);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: codemirror-migration, Property 6: Clear resets state completely**
   * *For any* editor state, calling `clear()` SHALL result in empty content 
   * and `isContentChanged()` returning false.
   * **Validates: Requirements 6.4**
   */
  it('Property 6: Clear resets state completely', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (initialContent) => {
          // Create a fresh editor for each test
          const testContainer = document.createElement('div');
          const testPreview = document.createElement('div') as HTMLDivElement;
          const testModeLabel = document.createElement('span') as HTMLSpanElement;
          document.body.appendChild(testContainer);
          
          const testEditor = new EditorManager(testContainer, testPreview, testModeLabel);
          
          try {
            // Set initial content
            testEditor.setContent(initialContent);
            
            // Clear the editor
            testEditor.clear();
            
            // Verify content is empty
            if (testEditor.getContent() !== '') {
              return false;
            }
            
            // Verify isContentChanged returns false
            return testEditor.isContentChanged() === false;
          } finally {
            document.body.removeChild(testContainer);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: codemirror-migration, Property 8: Task statistics accuracy**
   * *For any* document content, the task statistics (completed, total) SHALL 
   * accurately reflect the count of `- [x]`/`- [X]` and `- [ ]` patterns in the document.
   * **Validates: Requirements 6.7**
   */
  it('Property 8: Task statistics accuracy', () => {
    // Generator for task list items
    const taskItemGen = fc.record({
      checked: fc.boolean(),
      text: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes('[') && !s.includes(']') && !s.includes('\n'))
    });

    // Generator for mixed content with task lists
    const documentGen = fc.tuple(
      fc.array(taskItemGen, { minLength: 0, maxLength: 10 }),
      fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes('- ['))
    ).map(([tasks, extraText]) => {
      const taskLines = tasks.map(item => {
        const checkbox = item.checked ? '- [x]' : '- [ ]';
        return `${checkbox} ${item.text}`;
      });
      // Mix in some extra text
      return [...taskLines, extraText].join('\n');
    });

    fc.assert(
      fc.property(
        documentGen,
        (docContent) => {
          // Create a fresh editor for each test
          const testContainer = document.createElement('div');
          const testPreview = document.createElement('div') as HTMLDivElement;
          const testModeLabel = document.createElement('span') as HTMLSpanElement;
          document.body.appendChild(testContainer);
          
          const testEditor = new EditorManager(testContainer, testPreview, testModeLabel);
          
          // Track stats callback
          let receivedCompleted = -1;
          let receivedTotal = -1;
          testEditor.onStatsUpdate = (completed, total) => {
            receivedCompleted = completed;
            receivedTotal = total;
          };
          
          try {
            // Set content (this triggers updateStats via updatePreview)
            testEditor.setContent(docContent);
            
            // Calculate expected values
            const expectedTotal = (docContent.match(/- \[[ xX]\]/g) || []).length;
            const expectedCompleted = (docContent.match(/- \[[xX]\]/g) || []).length;
            
            // Verify stats match
            return receivedCompleted === expectedCompleted && receivedTotal === expectedTotal;
          } finally {
            document.body.removeChild(testContainer);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});


  /**
   * **Feature: codemirror-migration, Property 7: Line numbers match document lines**
   * *For any* document content, the number of line numbers displayed SHALL equal 
   * the number of lines in the document.
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Note: This test verifies that the line numbers extension is configured and that
   * the document line count is correctly tracked. In jsdom, CodeMirror's DOM rendering
   * may differ from a real browser, so we verify the state-level line count which
   * drives the line number display.
   */
  it('Property 7: Line numbers match document lines', () => {
    fc.assert(
      fc.property(
        // Generate content with varying number of lines
        fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 1, maxLength: 20 }).map(lines => lines.join('\n')),
        (docContent) => {
          // Create a fresh editor for each test
          const testContainer = document.createElement('div');
          const testPreview = document.createElement('div') as HTMLDivElement;
          const testModeLabel = document.createElement('span') as HTMLSpanElement;
          document.body.appendChild(testContainer);
          
          const testEditor = new EditorManager(testContainer, testPreview, testModeLabel);
          
          try {
            // Set content
            testEditor.setContent(docContent);
            
            // Get the CodeMirror view
            const view = (testEditor as any).view;
            
            // Count expected lines based on content
            // An empty string has 1 line, each newline adds a line
            const expectedLines = docContent === '' ? 1 : docContent.split('\n').length;
            
            // Verify CodeMirror's document line count matches expected
            const actualLines = view.state.doc.lines;
            
            // Verify the line numbers extension is present by checking for gutter element
            const hasLineNumbersGutter = testContainer.querySelector('.cm-lineNumbers') !== null;
            
            // The document line count should match expected, and line numbers should be enabled
            return actualLines === expectedLines && hasLineNumbersGutter;
          } finally {
            document.body.removeChild(testContainer);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

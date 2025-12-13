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
      { numRuns: 100 }
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
      { numRuns: 100 }
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
      { numRuns: 100 }
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
      { numRuns: 100 }
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
      { numRuns: 100 }
    );
  });
});

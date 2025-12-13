// Test setup file for CodeMirror migration tests
// This file configures the test environment for property-based testing

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock getClientRects for CodeMirror compatibility with jsdom
// jsdom doesn't implement getClientRects which CodeMirror needs for measurements
const mockDOMRect = {
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  top: 0,
  right: 100,
  bottom: 20,
  left: 0,
  toJSON: () => ({})
};

// Add getClientRects to Range prototype if not present
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => {
    const list = [mockDOMRect] as unknown as DOMRectList;
    (list as any).item = (index: number) => index === 0 ? mockDOMRect : null;
    (list as any).length = 1;
    return list;
  };
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => mockDOMRect as DOMRect;
}

// Also mock on Element if needed
if (!Element.prototype.getClientRects) {
  Element.prototype.getClientRects = () => {
    const list = [mockDOMRect] as unknown as DOMRectList;
    (list as any).item = (index: number) => index === 0 ? mockDOMRect : null;
    (list as any).length = 1;
    return list;
  };
}

// Suppress CodeMirror DOM measurement errors in jsdom
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress specific CodeMirror DOM measurement errors that occur in jsdom
  console.error = (...args: unknown[]) => {
    const firstArg = args[0];
    
    // Safely extract message string from first argument
    let message = '';
    if (typeof firstArg === 'string') {
      message = firstArg;
    } else if (firstArg instanceof Error) {
      message = firstArg.message;
    } else if (firstArg != null) {
      message = String(firstArg);
    }
    
    // Safely extract stack trace if available
    let stack = '';
    if (firstArg instanceof Error && firstArg.stack) {
      stack = firstArg.stack;
    }
    
    // Check for DOM measurement substrings
    const hasDOMMeasurementError = message.includes('getClientRects') || message.includes('textRange');
    
    // Check for CodeMirror indicator in message or stack
    const hasCodeMirrorIndicator = 
      message.includes('CodeMirror') || 
      message.includes('@codemirror') ||
      stack.includes('CodeMirror') ||
      stack.includes('@codemirror') ||
      /\bcm-/.test(message);
    
    // Only suppress when BOTH conditions are met
    if (hasDOMMeasurementError && hasCodeMirrorIndicator) {
      return; // Suppress CodeMirror DOM measurement errors
    }
    
    originalConsoleError.apply(console, args);
  };
  
  // Use fake timers to control requestAnimationFrame
  vi.useFakeTimers();
});

afterAll(() => {
  console.error = originalConsoleError;
  vi.useRealTimers();
});

afterEach(() => {
  // Advance timers to flush any pending animation frames
  vi.runAllTimers();
});

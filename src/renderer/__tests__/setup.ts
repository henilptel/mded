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
  // Suppress specific CodeMirror errors that occur in jsdom
  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('getClientRects') || message.includes('textRange')) {
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

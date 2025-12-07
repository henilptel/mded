export class ShortcutManager {
  private handlers: Map<string, (e: KeyboardEvent) => void> = new Map();

  constructor() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  register(key: string, handler: (e: KeyboardEvent) => void) {
    this.handlers.set(key.toLowerCase(), handler);
  }

  // Helper for simple Ctrl+Key or Ctrl+Shift+Key registration
  registerCtrl(key: string, handler: (e: KeyboardEvent) => void) {
      this.register(`ctrl+${key}`, handler);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.defaultPrevented) return;

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    
    // Key normalization
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    
    // Don't modify 'control', 'shift' etc presses themselves
    if (['control', 'shift', 'alt', 'meta'].includes(key)) return;

    parts.push(key);
    const chord = parts.join('+');

    if (this.handlers.has(chord)) {
      e.preventDefault();
      this.handlers.get(chord)!(e);
    }
  }
}

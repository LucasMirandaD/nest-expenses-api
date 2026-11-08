import { vi } from 'vitest';

// Compatibility setup for existing tests using jest.* globals
if (typeof (globalThis as any).jest === 'undefined') {
  (globalThis as any).jest = vi;
}

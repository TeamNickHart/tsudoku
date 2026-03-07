import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('@tsudoku/core', () => {
  it('exports a version string', () => {
    expect(VERSION).toBe('0.0.0');
  });
});

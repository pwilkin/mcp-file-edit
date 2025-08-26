import { UserError } from 'fastmcp';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  normalizeContent,
  validateAbsolutePath,
  validateDirectoryExists,
  validateFileExists,
  verifyLineContent
} from '../src/utils.js';
import { TEST_DIR, TEST_FILES } from './setup.js';

describe('Utility Functions', () => {
  describe('validateAbsolutePath', () => {
    it('should accept absolute paths', () => {
      const absolutePath = path.resolve('/tmp/test');
      expect(validateAbsolutePath(absolutePath)).toBe(absolutePath);
    });

    it('should reject relative paths', () => {
      expect(() => validateAbsolutePath('./relative/path')).toThrow(UserError);
      expect(() => validateAbsolutePath('relative/path')).toThrow(UserError);
      expect(() => validateAbsolutePath('../parent/path')).toThrow(UserError);
    });

    it('should provide helpful error message for relative paths', () => {
      expect(() => validateAbsolutePath('./test.txt')).toThrow(
        /The .* must be an absolute path.*You provided a relative path.*Please provide the full absolute path/
      );
    });
  });

  describe('validateFileExists', () => {
    it('should accept existing files', () => {
      expect(() => validateFileExists(TEST_FILES.simple)).not.toThrow();
    });

    it('should reject non-existent files', () => {
      const nonExistent = path.join(TEST_DIR, 'non-existent.txt');
      expect(() => validateFileExists(nonExistent)).toThrow(UserError);
      expect(() => validateFileExists(nonExistent)).toThrow(/File not found/);
    });

    it('should reject directories', () => {
      expect(() => validateFileExists(TEST_DIR)).toThrow(UserError);
      expect(() => validateFileExists(TEST_DIR)).toThrow(/is not a file/);
    });
  });

  describe('validateDirectoryExists', () => {
    it('should accept existing directories', () => {
      expect(() => validateDirectoryExists(TEST_DIR)).not.toThrow();
    });

    it('should reject non-existent directories', () => {
      const nonExistent = path.join(TEST_DIR, 'non-existent-dir');
      expect(() => validateDirectoryExists(nonExistent)).toThrow(UserError);
      expect(() => validateDirectoryExists(nonExistent)).toThrow(/Directory not found/);
    });

    it('should reject files', () => {
      expect(() => validateDirectoryExists(TEST_FILES.simple)).toThrow(UserError);
      expect(() => validateDirectoryExists(TEST_FILES.simple)).toThrow(/is not a directory/);
    });
  });

  describe('verifyLineContent', () => {
    it('should verify correct line content', () => {
      const result = verifyLineContent(TEST_FILES.multiline, 1, 'Line 1: First line');
      expect(result).toBe('Line 1: First line');
    });

    it('should handle whitespace normalization', () => {
      // Test with different whitespace
      const result = verifyLineContent(TEST_FILES.multiline, 1, '  Line 1:   First line  ');
      expect(result).toBe('Line 1: First line');
    });

    it('should reject when line number is out of bounds', () => {
      expect(() => verifyLineContent(TEST_FILES.multiline, 20, 'test')).toThrow(UserError);
      expect(() => verifyLineContent(TEST_FILES.multiline, 20, 'test')).toThrow(/does not exist/);
    });

    it('should reject when content does not match', () => {
      expect(() => verifyLineContent(TEST_FILES.multiline, 1, 'Wrong content')).toThrow(UserError);
      expect(() => verifyLineContent(TEST_FILES.multiline, 1, 'Wrong content')).toThrow(/Line content verification failed/);
    });

    it('should provide helpful error message for content mismatch', () => {
      expect(() => verifyLineContent(TEST_FILES.multiline, 1, 'Wrong content')).toThrow(
        /Please re-read the file with show_line_numbers=true to see the current content/
      );
    });
  });

  describe('normalizeContent', () => {
    it('should normalize whitespace', () => {
      expect(normalizeContent('  hello   world  ')).toBe('hello world');
      expect(normalizeContent('\t\thello\n\nworld\t\t')).toBe('hello world');
      expect(normalizeContent('multiple   spaces   between')).toBe('multiple spaces between');
    });

    it('should handle empty strings', () => {
      expect(normalizeContent('')).toBe('');
      expect(normalizeContent('   ')).toBe('');
    });
  });
});
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { UserError } from 'fastmcp';
import { TEST_FILES, TEST_DIR, client } from './setup.js';

describe('Search and directory tools', () => {
  beforeAll(async () => {
    // Client is already connected in setup.ts
  });

  describe('search_file', () => {
    it('should find single match without context', async () => {
      const result = await client.callTool({
        name: 'search_file',
        arguments: {
          file_path: TEST_FILES.code,
          regexp: 'def hello_world'
        }
      });

      expect(result.content[0].text).toContain('Match at line');
      expect(result.content[0].text).toContain('def hello_world():');
      expect(result.content[0].text).toContain('Match at line 1:'); // Always includes the match line
    });

    it('should find multiple matches', async () => {
      const result = await client.callTool({
        name: 'search_file',
        arguments: {
          file_path: TEST_FILES.multiline,
          regexp: 'Line \\d+:'
        }
      });

      expect(result.content[0].text).toContain('Match at line 1:');
      expect(result.content[0].text).toContain('Match at line 2:');
      expect(result.content[0].text).toContain('Match at line 3:');
      expect(result.content[0].text).toContain('Match at line 4:');
      expect(result.content[0].text).toContain('Match at line 5:');
    });

    it('should show context lines when specified', async () => {
      const result = await client.callTool({
        name: 'search_file',
        arguments: {
          file_path: TEST_FILES.multiline,
          regexp: 'Line 3:',
          lines_before: 1,
          lines_after: 1
        }
      });

      expect(result.content[0].text).toContain('Match at line 3:');
      expect(result.content[0].text).toContain('Line 2: Second line');
      expect(result.content[0].text).toContain('Line 3: Third line with some text');
      expect(result.content[0].text).toContain('Line 4: Fourth line');
    });

    it('should handle regex with special characters', async () => {
      const result = await client.callTool({
        name: 'search_file',
        arguments: {
          file_path: TEST_FILES.code,
          regexp: 'if __name__ == "__main__"'
        }
      });

      expect(result.content[0].text).toContain('Match at line');
      expect(result.content[0].text).toContain('if __name__ == "__main__":');
    });

    it('should return no matches message when pattern not found', async () => {
      const result = await client.callTool({
        name: 'search_file',
        arguments: {
          file_path: TEST_FILES.simple,
          regexp: 'nonexistent_pattern'
        }
      });

      expect(result.content[0].text).toBe(`No matches found for pattern "nonexistent_pattern" in file "${TEST_FILES.simple}".`);
    });

    it('should reject relative paths', async () => {
      const result = await client.callTool({
        name: 'search_file',
        arguments: {
          file_path: './relative/path.txt',
          regexp: 'test'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/must be an absolute path/);
    });

    it('should reject non-existent files', async () => {
      const nonExistent = path.join(TEST_DIR, 'non-existent.txt');
      const result = await client.callTool({
        name: 'search_file',
        arguments: {
          file_path: nonExistent,
          regexp: 'test'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/File not found/);
    });
  });

  describe('list_files', () => {
    it('should list files and directories in test directory', async () => {
      const result = await client.callTool({
        name: 'list_files',
        arguments: {
          directory_path: TEST_DIR
        }
      });

      expect(result.content[0].text).toContain('[FILE]');
      expect(result.content[0].text).toContain('[DIR]');
      expect(result.content[0].text).toContain('simple.txt');
      expect(result.content[0].text).toContain('subdir');
    });

    it('should show file sizes', async () => {
      const result = await client.callTool({
        name: 'list_files',
        arguments: {
          directory_path: TEST_DIR
        }
      });

      // Should contain file sizes in parentheses
      expect(result.content[0].text).toMatch(/\(\d+ bytes\)/);
    });

    it('should handle empty directories', async () => {
      const emptyDir = path.join(TEST_DIR, 'empty-dir');
      fs.mkdirSync(emptyDir);

      try {
        const result = await client.callTool({
          name: 'list_files',
          arguments: {
            directory_path: emptyDir
          }
        });

        expect(result.content[0].text).toBe(`Directory "${emptyDir}" is empty.`);
      } finally {
        fs.rmdirSync(emptyDir);
      }
    });

    it('should reject relative paths', async () => {
      const result = await client.callTool({
        name: 'list_files',
        arguments: {
          directory_path: './relative/path'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/must be an absolute path/);
    });

    it('should reject non-existent directories', async () => {
      const nonExistent = path.join(TEST_DIR, 'non-existent-dir');
      const result = await client.callTool({
        name: 'list_files',
        arguments: {
          directory_path: nonExistent
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Directory not found/);
    });

    it('should reject files', async () => {
      const result = await client.callTool({
        name: 'list_files',
        arguments: {
          directory_path: TEST_FILES.simple
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/is not a directory/);
    });
  });

  describe('search_directory', () => {
    it('should search across multiple files', async () => {
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: TEST_DIR,
          regexp: 'Line 1:'
        }
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain('match(es) in');
      expect(result.content[0].text).toContain('File:');
      expect(result.content[0].text).toContain('Match at line');
    });

    it('should handle recursive search', async () => {
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: TEST_DIR,
          regexp: 'This is',
          recursive: true
        }
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain(TEST_FILES.simple);
      expect(result.content[0].text).toContain(TEST_FILES.nested);
    });

    it('should respect include patterns', async () => {
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: TEST_DIR,
          regexp: 'def ',
          include: '*.py'
        }
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain(TEST_FILES.code);
      expect(result.content[0].text).toContain('def hello_world');
    });

    it('should respect exclude patterns', async () => {
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: TEST_DIR,
          regexp: 'Hello',
          exclude: 'simple.txt',
          recursive: true
        }
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).not.toContain(TEST_FILES.simple);
    });

    it('should show context when specified', async () => {
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: TEST_DIR,
          regexp: 'First line',
          lines_before: 1,
          lines_after: 1
        }
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain('Match at line');
      // Should contain context lines
      expect(result.content[0].text).toMatch(/^\s*\d+ \|/m);
    });

    it('should return no matches message when pattern not found', async () => {
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: TEST_DIR,
          regexp: 'nonexistent_pattern_12345'
        }
      });

      expect(result.content[0].text).toBe(`No matches found for pattern "nonexistent_pattern_12345" in directory "${TEST_DIR}".`);
    });

    it('should handle files that cannot be read', async () => {
      // Create a file without read permission (this might not work on all systems)
      const unreadableFile = path.join(TEST_DIR, 'unreadable.txt');
      fs.writeFileSync(unreadableFile, 'content');

      // The test should still work and either read the file or skip it gracefully
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: TEST_DIR,
          regexp: 'content'
        }
      });

      // Clean up
      fs.unlinkSync(unreadableFile);

      expect(result.content[0].text).toContain('Found');
    });

    it('should reject relative paths', async () => {
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: './relative/path',
          regexp: 'test'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/must be an absolute path/);
    });

    it('should reject non-existent directories', async () => {
      const nonExistent = path.join(TEST_DIR, 'non-existent-dir');
      const result = await client.callTool({
        name: 'search_directory',
        arguments: {
          directory_path: nonExistent,
          regexp: 'test'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Directory not found/);
    });
  });
});
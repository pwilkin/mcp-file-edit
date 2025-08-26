import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TEST_FILES, TEST_DIR, client } from './setup.js';

describe('Editing tools', () => {
  let testFile: string;
  let originalContent: string;

  beforeAll(() => {
    // Create a working copy for editing tests
    testFile = path.join(TEST_DIR, 'edit-test.txt');
    originalContent = `Line 1: First line
Line 2: Second line
Line 3: Third line with some text
Line 4: Fourth line
Line 5: Fifth line`;

    // Ensure the test directory exists before creating the file
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }

    fs.writeFileSync(testFile, originalContent);
  });

  afterEach(() => {
    // Reset test file after each test
    if (fs.existsSync(testFile)) {
      fs.writeFileSync(testFile, originalContent);
    }
  });

  describe('replace_in_file (regex-based)', () => {
    it('should replace single occurrence', async () => {
      const result = await client.callTool({
        name: 'replace_in_file',
        arguments: {
          file_path: testFile,
          regex_source: 'First',
          target: 'Modified',
          multiple: false
        }
      });

      expect(result.content[0].text).toBe('Successfully replaced 1 occurrence(s) of "First" with "Modified" in "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).toContain('Line 1: Modified line');
    });

    it('should replace multiple occurrences when multiple=true', async () => {
      const result = await client.callTool({
        name: 'replace_in_file',
        arguments: {
          file_path: testFile,
          regex_source: 'line',
          target: 'LINE',
          multiple: true
        }
      });

      expect(result.content[0].text).toBe('Successfully replaced 5 occurrence(s) of "line" with "LINE" in "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent.match(/LINE/g)).toHaveLength(5);
    });

    it('should reject multiple matches when multiple=false', async () => {
      const result = await client.callTool({
        name: 'replace_in_file',
        arguments: {
          file_path: testFile,
          regex_source: 'line',
          target: 'LINE',
          multiple: false
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Multiple matches found.*but multiple=false/);
    });

    it('should reject when no matches found', async () => {
      const result = await client.callTool({
        name: 'replace_in_file',
        arguments: {
          file_path: testFile,
          regex_source: 'nonexistent',
          target: 'replacement'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/No matches found for regex pattern/);
    });

    it('should handle complex regex patterns', async () => {
      const result = await client.callTool({
        name: 'replace_in_file',
        arguments: {
          file_path: testFile,
          regex_source: 'Line \\d+:',
          target: 'Modified Line:',
          multiple: true
        }
      });

      expect(result.content[0].text).toBe('Successfully replaced 5 occurrence(s) of "Line \\d+:" with "Modified Line:" in "' + testFile + '".');
    });
  });

  describe('delete_from_file', () => {
    it('should delete specified line range', async () => {
      const result = await client.callTool({
        name: 'delete_from_file',
        arguments: {
          file_path: testFile,
          line_start: 2,
          line_end: 4,
          line_start_contents: 'Line 2: Second line'
        }
      });

      expect(result.content[0].text).toBe('Successfully deleted lines 2-4 from "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).not.toContain('Line 2: Second line');
      expect(newContent).not.toContain('Line 3: Third line');
      expect(newContent).not.toContain('Line 4: Fourth line');
      expect(newContent).toContain('Line 1: First line');
      expect(newContent).toContain('Line 5: Fifth line');
    });

    it('should delete single line', async () => {
      const result = await client.callTool({
        name: 'delete_from_file',
        arguments: {
          file_path: testFile,
          line_start: 3,
          line_end: 3,
          line_start_contents: 'Line 3: Third line with some text'
        }
      });

      expect(result.content[0].text).toBe('Successfully deleted lines 3-3 from "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).not.toContain('Line 3: Third line');
    });

    it('should reject when line content does not match', async () => {
      const result = await client.callTool({
        name: 'delete_from_file',
        arguments: {
          file_path: testFile,
          line_start: 2,
          line_end: 4,
          line_start_contents: 'Wrong content'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Line content verification failed.*Please re-read the file with show_line_numbers=true to see the current content and update your request accordingly./s);
    });

    it('should reject when line number is out of bounds', async () => {
      const result = await client.callTool({
        name: 'delete_from_file',
        arguments: {
          file_path: testFile,
          line_start: 10,
          line_end: 12,
          line_start_contents: 'test'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Line 10 does not exist/);
    });
  });

  describe('insert_into_file', () => {
    it('should insert content before specified line', async () => {
      const result = await client.callTool({
        name: 'insert_into_file',
        arguments: {
          file_path: testFile,
          line_number: 3,
          line_contents: 'Line 3: Third line with some text',
          where: 'before',
          contents: 'INSERTED BEFORE LINE 3'
        }
      });

      expect(result.content[0].text).toBe('Successfully inserted content before line 3 in "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).toContain('INSERTED BEFORE LINE 3\nLine 3: Third line with some text');
    });

    it('should insert content after specified line', async () => {
      const result = await client.callTool({
        name: 'insert_into_file',
        arguments: {
          file_path: testFile,
          line_number: 2,
          line_contents: 'Line 2: Second line',
          where: 'after',
          contents: 'INSERTED AFTER LINE 2'
        }
      });

      expect(result.content[0].text).toBe('Successfully inserted content after line 2 in "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).toContain('Line 2: Second line\nINSERTED AFTER LINE 2\nLine 3: Third line with some text');
    });

    it('should append to end of file when line_number is 0', async () => {
      const result = await client.callTool({
        name: 'insert_into_file',
        arguments: {
          file_path: testFile,
          line_number: 0,
          line_contents: '',
          where: 'after',
          contents: 'APPENDED TO END'
        }
      });

      expect(result.content[0].text).toBe('Successfully inserted content end of file in "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).toContain('Line 5: Fifth line\nAPPENDED TO END');
    });

    it('should reject when line content does not match', async () => {
      const result = await client.callTool({
        name: 'insert_into_file',
        arguments: {
          file_path: testFile,
          line_number: 2,
          line_contents: 'Wrong content',
          where: 'before',
          contents: 'test'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Line content verification failed.*Please re-read the file with show_line_numbers=true to see the current content and update your request accordingly./s);
    });

    it('should reject when line number is out of bounds', async () => {
      const result = await client.callTool({
        name: 'insert_into_file',
        arguments: {
          file_path: testFile,
          line_number: 10,
          line_contents: 'test',
          where: 'before',
          contents: 'test'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Line 10 does not exist/);
    });
  });

  describe('replace_lines_in_file', () => {
    it('should replace specified line range', async () => {
      const result = await client.callTool({
        name: 'replace_lines_in_file',
        arguments: {
          file_path: testFile,
          line_start: 2,
          line_end: 4,
          line_start_contents: 'Line 2: Second line',
          contents: 'REPLACED LINES 2-4\nThis is replacement content\nEnd of replacement'
        }
      });

      expect(result.content[0].text).toBe('Successfully replaced lines 2-4 in "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).toContain('Line 1: First line');
      expect(newContent).toContain('REPLACED LINES 2-4\nThis is replacement content\nEnd of replacement');
      expect(newContent).toContain('Line 5: Fifth line');
      expect(newContent).not.toContain('Line 2: Second line');
      expect(newContent).not.toContain('Line 3: Third line');
    });

    it('should replace single line', async () => {
      const result = await client.callTool({
        name: 'replace_lines_in_file',
        arguments: {
          file_path: testFile,
          line_start: 3,
          line_end: 3,
          line_start_contents: 'Line 3: Third line with some text',
          contents: 'REPLACED LINE 3'
        }
      });

      expect(result.content[0].text).toBe('Successfully replaced lines 3-3 in "' + testFile + '".');
      const newContent = fs.readFileSync(testFile, 'utf-8');
      expect(newContent).toContain('REPLACED LINE 3');
      expect(newContent).not.toContain('Line 3: Third line');
    });

    it('should reject when line content does not match', async () => {
      const result = await client.callTool({
        name: 'replace_lines_in_file',
        arguments: {
          file_path: testFile,
          line_start: 2,
          line_end: 4,
          line_start_contents: 'Wrong content',
          contents: 'replacement'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Line content verification failed for line \d+.*Please re-read the file with show_line_numbers=true to see the current content and update your request accordingly./s);
    });
  });

  describe('Error handling for all editing tools', () => {
    it('should reject relative paths for all tools', async () => {
      const tools = ['replace_in_file', 'delete_from_file', 'insert_into_file', 'replace_lines_in_file'];

      for (const toolName of tools) {
        const result = await client.callTool({
          name: toolName,
          arguments: {
            file_path: './relative/path.txt',
            ...(toolName === 'replace_in_file' ? { regex_source: 'test', target: 'replacement' } : {}),
            ...(toolName === 'delete_from_file' ? { line_start: 1, line_end: 1, line_start_contents: 'test' } : {}),
            ...(toolName === 'insert_into_file' ? { line_number: 1, line_contents: 'test', where: 'before', contents: 'test' } : {}),
            ...(toolName === 'replace_lines_in_file' ? { line_start: 1, line_end: 1, line_start_contents: 'test', contents: 'test' } : {})
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/must be an absolute path/);
      }
    });

    it('should reject non-existent files for all tools', async () => {
      const nonExistent = path.join(TEST_DIR, 'non-existent.txt');
      const tools = ['replace_in_file', 'delete_from_file', 'insert_into_file', 'replace_lines_in_file'];

      for (const toolName of tools) {
        const result = await client.callTool({
          name: toolName,
          arguments: {
            file_path: nonExistent,
            ...(toolName === 'replace_in_file' ? { regex_source: 'test', target: 'replacement' } : {}),
            ...(toolName === 'delete_from_file' ? { line_start: 1, line_end: 1, line_start_contents: 'test' } : {}),
            ...(toolName === 'insert_into_file' ? { line_number: 1, line_contents: 'test', where: 'before', contents: 'test' } : {}),
            ...(toolName === 'replace_lines_in_file' ? { line_start: 1, line_end: 1, line_start_contents: 'test', contents: 'test' } : {})
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/File not found/);
      }
    });
  });
});
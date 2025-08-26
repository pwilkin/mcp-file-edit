import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { TEST_FILES, TEST_DIR, client } from './setup.js';

describe('read_file tool', () => {
  // Use the MCP client to test the real server

  describe('Success cases', () => {
    it('should read entire file with full=true', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.simple,
          full: true
        }
      });

      const expected = fs.readFileSync(TEST_FILES.simple, 'utf-8');
      expect(result.content[0].text).toBe(expected);
    });

    it('should read entire file by default', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.simple
        }
      });

      const expected = fs.readFileSync(TEST_FILES.simple, 'utf-8');
      expect(result.content[0].text).toBe(expected);
    });

    it('should read specific line range', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.multiline,
          start_line: 2,
          end_line: 4
        }
      });

      expect(result.content[0].text).toBe('Line 2: Second line\nLine 3: Third line with some text\nLine 4: Fourth line');
    });

    it('should read with line numbers', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.multiline,
          start_line: 2,
          end_line: 4,
          show_line_numbers: true
        }
      });

      expect(result.content[0].text).toBe('2 | Line 2: Second line\n3 | Line 3: Third line with some text\n4 | Line 4: Fourth line');
    });

    it('should read single line', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.multiline,
          start_line: 5,
          end_line: 5
        }
      });

      expect(result.content[0].text).toBe('Line 5: Fifth line');
    });

    it('should read from start to middle', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.multiline,
          start_line: 1,
          end_line: 5
        }
      });

      expect(result.content[0].text).toBe('Line 1: First line\nLine 2: Second line\nLine 3: Third line with some text\nLine 4: Fourth line\nLine 5: Fifth line');
    });
  });

  describe('Error cases', () => {
    it('should reject relative paths', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: './relative/path.txt'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/must be an absolute path/);
    });

    it('should reject non-existent files', async () => {
      const nonExistent = `${TEST_DIR}/non-existent.txt`;
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: nonExistent
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/File not found/);
    });

    it('should reject directories', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_DIR
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/is not a file/);
    });

    it('should reject full=true with line ranges', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.simple,
          full: true,
          start_line: 1,
          end_line: 2
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Cannot use "full" parameter together with/);
    });

    it('should reject incomplete line ranges', async () => {
      const result1 = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.simple,
          start_line: 1
        }
      });

      expect(result1.isError).toBe(true);
      expect(result1.content[0].text).toMatch(/Both "start_line" and "end_line" must be provided/);

      const result2 = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.simple,
          end_line: 2
        }
      });

      expect(result2.isError).toBe(true);
    });

    it('should reject invalid line ranges', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.simple,
          start_line: 2,
          end_line: 1
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/"start_line" must be less than or equal to "end_line"/);
    });

    it('should reject line numbers beyond file length', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.simple,
          start_line: 10,
          end_line: 15
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/is beyond the file length/);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty files', async () => {
      const emptyFile = `${TEST_DIR}/empty.txt`;
      fs.writeFileSync(emptyFile, '');

      try {
        const result = await client.callTool({
          name: 'read_file',
          arguments: {
            file_path: emptyFile,
            full: true
          }
        });
        expect(result.content[0].text).toBe('');
      } finally {
        fs.unlinkSync(emptyFile);
      }
    });

    it('should handle file with only newlines', async () => {
      const newlineFile = `${TEST_DIR}/newlines.txt`;
      fs.writeFileSync(newlineFile, '\n\n\n');

      try {
        const result = await client.callTool({
          name: 'read_file',
          arguments: {
            file_path: newlineFile,
            full: true
          }
        });
        expect(result.content[0].text).toBe('\n\n\n');
      } finally {
        fs.unlinkSync(newlineFile);
      }
    });

    it('should handle reading last line', async () => {
      const result = await client.callTool({
        name: 'read_file',
        arguments: {
          file_path: TEST_FILES.multiline,
          start_line: 10,
          end_line: 10
        }
      });

      expect(result.content[0].text).toBe('Line 10: Tenth line');
    });
  });
});
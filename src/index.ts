#!/usr/bin/env node

import { FastMCP, UserError } from 'fastmcp';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateAbsolutePath,
  validateFileExists,
  validateDirectoryExists,
  verifyLineContent,
  normalizeContent
} from './utils.js';

const version = "1.0.0";

const server = new FastMCP({
  name: 'FileEditor',
  version: version,
});

// Tool 1: read_file
server.addTool({
  name: 'read_file',
  description: 'Read the contents of a file. You can read the entire file or specific line ranges.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file to read'),
    show_line_numbers: z.boolean().optional().default(false).describe('Whether to prefix each line with its line number'),
    start_line: z.number().int().positive().optional().describe('Starting line number (1-based). Cannot be used with full=true'),
    end_line: z.number().int().positive().optional().describe('Ending line number (1-based). Cannot be used with full=true'),
    full: z.boolean().optional().describe('Read the entire file. Cannot be used with start_line or end_line')
  }),
  execute: async ({ file_path, show_line_numbers, start_line, end_line, full }) => {
    // Validate parameters
    if (full && (start_line || end_line)) {
      throw new UserError('Cannot use "full" parameter together with "start_line" or "end_line". Choose either full=true or specify line ranges.');
    }
    if ((start_line && !end_line) || (!start_line && end_line)) {
      throw new UserError('Both "start_line" and "end_line" must be provided together.');
    }
    if (start_line && end_line && start_line > end_line) {
      throw new UserError('"start_line" must be less than or equal to "end_line".');
    }

    const absolutePath = validateAbsolutePath(file_path, 'file_path');
    validateFileExists(absolutePath);

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');

      let resultLines: string[];

      if (full) {
        resultLines = lines;
      } else if (start_line && end_line) {
        if (start_line > lines.length) {
          throw new UserError(`Start line ${start_line} is beyond the file length (${lines.length} lines).`);
        }
        if (end_line > lines.length) {
          throw new UserError(`End line ${end_line} is beyond the file length (${lines.length} lines).`);
        }
        resultLines = lines.slice(start_line - 1, end_line); // Convert to 0-based
      } else {
        resultLines = lines;
      }

      if (show_line_numbers) {
        const startLineNum = start_line || 1;
        return resultLines.map((line, index) => `${startLineNum + index} | ${line}`).join('\n');
      } else {
        return resultLines.join('\n');
      }
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error reading file "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 2: replace_in_file (regex-based)
server.addTool({
  name: 'replace_in_file',
  description: 'Replace all occurrences of a regex pattern with a target string in a file.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    regex_source: z.string().describe('Regular expression pattern to search for'),
    target: z.string().describe('String to replace matches with'),
    multiple: z.boolean().optional().describe('Allow multiple replacements. If false, fails if multiple matches found.')
  }),
  execute: async ({ file_path, regex_source, target, multiple }) => {
    const absolutePath = validateAbsolutePath(file_path, 'file_path');
    validateFileExists(absolutePath);

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const regex = new RegExp(regex_source, 'g');
      const matches = content.match(regex);

      if (!matches) {
        throw new UserError(`No matches found for regex pattern "${regex_source}" in file "${absolutePath}".`);
      }

      if (!multiple && matches.length > 1) {
        throw new UserError(
          `Multiple matches found (${matches.length}) for regex pattern "${regex_source}" in file "${absolutePath}", ` +
          `but multiple=false. Either set multiple=true or refine your regex to match only one occurrence.`
        );
      }

      const newContent = content.replace(regex, target);
      fs.writeFileSync(absolutePath, newContent, 'utf-8');

      return `Successfully replaced ${matches.length} occurrence(s) of "${regex_source}" with "${target}" in "${absolutePath}".`;
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error performing replacement in file "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 3: delete_from_file
server.addTool({
  name: 'delete_from_file',
  description: 'Delete content from a file between specified line numbers.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    line_start: z.number().int().positive().describe('Starting line number (1-based)'),
    line_end: z.number().int().positive().describe('Ending line number (1-based)'),
    line_start_contents: z.string().describe('Expected content of the starting line (used for verification)')
  }),
  execute: async ({ file_path, line_start, line_end, line_start_contents }) => {
    const absolutePath = validateAbsolutePath(file_path, 'file_path');
    validateFileExists(absolutePath);

    try {
      // Verify the starting line content
      verifyLineContent(absolutePath, line_start, line_start_contents);

      const content = fs.readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');

      if (line_start > lines.length || line_end > lines.length) {
        throw new UserError(`Line range ${line_start}-${line_end} is beyond file length (${lines.length} lines).`);
      }

      if (line_start > line_end) {
        throw new UserError('line_start must be less than or equal to line_end.');
      }

      // Remove the specified lines (inclusive)
      const newLines = [
        ...lines.slice(0, line_start - 1), // Lines before start
        ...lines.slice(line_end) // Lines after end
      ];

      const newContent = newLines.join('\n');
      fs.writeFileSync(absolutePath, newContent, 'utf-8');

      return `Successfully deleted lines ${line_start}-${line_end} from "${absolutePath}".`;
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error deleting content from file "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 4: insert_into_file
server.addTool({
  name: 'insert_into_file',
  description: 'Insert content into a file at a specific line position.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    line_number: z.number().int().min(0).describe('Line number to insert at (1-based). Use 0 to append to end.'),
    line_contents: z.string().describe('Expected content of the target line (used for verification)'),
    where: z.enum(['before', 'after']).describe('Whether to insert before or after the target line'),
    contents: z.string().describe('Content to insert')
  }),
  execute: async ({ file_path, line_number, line_contents, where, contents }) => {
    const absolutePath = validateAbsolutePath(file_path, 'file_path');
    validateFileExists(absolutePath);

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');

      if (line_number === 0) {
        // Append to end
        lines.push(contents);
      } else {
        // Verify line content
        verifyLineContent(absolutePath, line_number, line_contents);

        // Insert at specified position
        const insertIndex = where === 'after' ? line_number : line_number - 1;
        lines.splice(insertIndex, 0, contents);
      }

      const newContent = lines.join('\n');
      fs.writeFileSync(absolutePath, newContent, 'utf-8');

      const position = line_number === 0 ? 'end of file' : `${where} line ${line_number}`;
      return `Successfully inserted content ${position} in "${absolutePath}".`;
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error inserting content into file "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 5: replace_in_file (line-based)
server.addTool({
  name: 'replace_lines_in_file',
  description: 'Replace content between specific line numbers in a file.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    line_start: z.number().int().positive().describe('Starting line number (1-based)'),
    line_end: z.number().int().positive().describe('Ending line number (1-based)'),
    line_start_contents: z.string().describe('Expected content of the starting line (used for verification)'),
    contents: z.string().describe('New content to replace the lines with')
  }),
  execute: async ({ file_path, line_start, line_end, line_start_contents, contents }) => {
    const absolutePath = validateAbsolutePath(file_path, 'file_path');
    validateFileExists(absolutePath);

    try {
      // Verify the starting line content
      verifyLineContent(absolutePath, line_start, line_start_contents);

      const content = fs.readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');

      if (line_start > lines.length || line_end > lines.length) {
        throw new UserError(`Line range ${line_start}-${line_end} is beyond file length (${lines.length} lines).`);
      }

      if (line_start > line_end) {
        throw new UserError('line_start must be less than or equal to line_end.');
      }

      // Replace the specified lines
      const newLines = [
        ...lines.slice(0, line_start - 1), // Lines before start
        contents, // New content
        ...lines.slice(line_end) // Lines after end
      ];

      const newContent = newLines.join('\n');
      fs.writeFileSync(absolutePath, newContent, 'utf-8');

      return `Successfully replaced lines ${line_start}-${line_end} in "${absolutePath}".`;
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error replacing content in file "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 6: multireplace_lines_in_file
server.addTool({
  name: 'multireplace_lines_in_file',
  description: 'Replace multiple line ranges in a file. All line numbers and content refer to the original file state.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    edits: z.array(z.object({
      line_start: z.number().int().positive().describe('Starting line number (1-based) from original file'),
      line_end: z.number().int().positive().describe('Ending line number (1-based) from original file'),
      line_start_contents: z.string().describe('Expected content of the starting line from original file'),
      contents: z.string().describe('New content to replace the lines with')
    })).describe('Array of edit operations to perform')
  }),
  execute: async ({ file_path, edits }) => {
    const absolutePath = validateAbsolutePath(file_path, 'file_path');
    validateFileExists(absolutePath);

    try {
      // Read the original file once - all line numbers and content refer to this state
      const originalContent = fs.readFileSync(absolutePath, 'utf-8');
      const originalLines = originalContent.split('\n');

      const results: Array<{
        index: number;
        success: boolean;
        error?: string;
        line_start: number;
        line_end: number;
        shift?: number;
      }> = [];

      // Create a working copy of the file content
      let workingLines = [...originalLines];

      // Track line shifts for each edit to report accurate information
      const lineShifts: Array<{ start: number; end: number; shift: number }> = [];
      edits = edits.sort((a, b) => {
        if (a.line_start < b.line_start) {
          return -1;
        } else if (a.line_start > b.line_start) {
          return 1;
        } else if (a.line_end < b.line_end) {
          return -1;
        } else if (a.line_end > b.line_end) {
          return 1;
        } else {
          return 0;
        }
      });

      // Check for overlaps
      let previousEnd = -1;
      for (const edit of edits) {
        if (edit.line_start <= previousEnd) {
          throw new UserError(`Found overlapping ranges starting from line ${edit.line_start}. Please make sure the line ranges are mutually exclusive.`);
        }
        previousEnd = edit.line_end;
      }

      // Process each edit in order
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const result: {
          index: number;
          success: boolean;
          error?: string;
          line_start: number;
          line_end: number;
          shift?: number;
        } = {
          index: i,
          success: false,
          line_start: edit.line_start,
          line_end: edit.line_end
        };

        try {
          // Verify the starting line content against the ORIGINAL file
          if (edit.line_start > originalLines.length) {
            throw new UserError(`Line ${edit.line_start} does not exist in the original file (${originalLines.length} lines).`);
          }

          if (edit.line_end > originalLines.length) {
            throw new UserError(`Line ${edit.line_end} does not exist in the original file (${originalLines.length} lines).`);
          }

          if (edit.line_start > edit.line_end) {
            throw new UserError('line_start must be less than or equal to line_end.');
          }

          const originalLineContent = originalLines[edit.line_start - 1];
          if (originalLineContent !== edit.line_start_contents) {
            throw new UserError(`Line content verification failed for line ${edit.line_start} in "${absolutePath}".
Expected (normalized): "${normalizeContent(edit.line_start_contents)}"
Actual (normalized): "${normalizeContent(originalLineContent)}"
Please re-read the file with show_line_numbers=true to see the current content and update your request accordingly.`);
          }

          // Find the current position of the target lines in the working copy
          // We need to map from original line numbers to current line numbers by accounting for previous edits
          let currentStartIndex = edit.line_start - 1; // Start with original position
          let currentEndIndex = edit.line_end - 1;     // Start with original position

          // Adjust for all previous edits that occurred before this line
          for (const shift of lineShifts) {
            if (shift.start <= edit.line_start) {
              // This edit occurred at or before our target line, so adjust our indices
              const adjustment = shift.shift;
              currentStartIndex += adjustment;
              currentEndIndex += adjustment;
            }
          }

          // Verify the target range still exists in the current working copy
          if (currentStartIndex >= workingLines.length) {
            throw new UserError(`After previous edits, the target line range starting at original line ${edit.line_start} no longer exists in the file.`);
          }

          if (currentEndIndex >= workingLines.length) {
            currentEndIndex = workingLines.length - 1; // Clamp to end of file
          }

          // Calculate the line shift that this edit will cause
          const originalRangeLength = edit.line_end - edit.line_start + 1;
          const newContentLength = edit.contents.split('\n').length;
          const shift = newContentLength - originalRangeLength;

          // Perform the replacement in the working copy
          const newLines = [
            ...workingLines.slice(0, currentStartIndex), // Lines before start
            ...edit.contents.split('\n'), // New content (split into lines)
            ...workingLines.slice(currentEndIndex + 1) // Lines after end
          ];

          workingLines = newLines;
          result.success = true;
          result.shift = shift;

          // Record this shift for future edits
          lineShifts.push({
            start: edit.line_start,
            end: edit.line_end,
            shift: shift
          });

        } catch (error: any) {
          result.success = false;
          result.error = error instanceof UserError ? error.message : `Error: ${error.message}`;
        }

        results.push(result);
      }

      // Write the final content back to the file
      const finalContent = workingLines.join('\n');
      fs.writeFileSync(absolutePath, finalContent, 'utf-8');

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return `Completed ${successful} successful edits and ${failed} failed edits in "${absolutePath}".\n\n` +
             results.map(r =>
               `Edit ${r.index}: ${r.success ? 'SUCCESS' : 'FAILED'} - ` +
               `lines ${r.line_start}-${r.line_end}` +
               (r.success && r.shift !== undefined ? ` (shift: ${r.shift > 0 ? '+' : ''}${r.shift} lines)` : '') +
               (r.success ? '' : ` - ${r.error}`)
             ).join('\n');
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error performing multi-edit in file "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 7: search_file
server.addTool({
  name: 'search_file',
  description: 'Search for regex patterns in a file and show matching lines with context.',
  parameters: z.object({
    file_path: z.string().describe('Absolute path to the file'),
    regexp: z.string().describe('Regular expression pattern to search for'),
    lines_before: z.number().int().min(0).optional().describe('Number of lines to show before each match'),
    lines_after: z.number().int().min(0).optional().describe('Number of lines to show after each match')
  }),
  execute: async ({ file_path, regexp, lines_before, lines_after }) => {
    const absolutePath = validateAbsolutePath(file_path, 'file_path');
    validateFileExists(absolutePath);

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');
      const regex = new RegExp(regexp);
      const matches: string[] = [];

      lines.forEach((line, index) => {
        if (regex.test(line)) {
          const lineNumber = index + 1; // 1-based
          const startLine = Math.max(1, lineNumber - (lines_before || 0));
          const endLine = Math.min(lines.length, lineNumber + (lines_after || 0));

          const contextLines = lines.slice(startLine - 1, endLine);
          const context = contextLines.map((ctxLine, ctxIndex) => {
            const ctxLineNumber = startLine + ctxIndex;
            const marker = ctxLineNumber === lineNumber ? '>' : ' ';
            return `${marker} ${ctxLineNumber} | ${ctxLine}`;
          }).join('\n');

          matches.push(`Match at line ${lineNumber}:\n${context}`);
        }
      });

      if (matches.length === 0) {
        return `No matches found for pattern "${regexp}" in file "${absolutePath}".`;
      }

      return matches.join('\n\n');
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error searching file "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 8: list_files
server.addTool({
  name: 'list_files',
  description: 'List all files and subdirectories in a given directory.',
  parameters: z.object({
    directory_path: z.string().describe('Absolute path to the directory to list')
  }),
  execute: async ({ directory_path }) => {
    const absolutePath = validateAbsolutePath(directory_path, 'directory_path');
    validateDirectoryExists(absolutePath);

    try {
      const items = fs.readdirSync(absolutePath);
      const results: string[] = [];

      items.forEach(item => {
        const itemPath = path.join(absolutePath, item);
        const stats = fs.statSync(itemPath);
        const type = stats.isDirectory() ? '[DIR]' : '[FILE]';
        const size = stats.isFile() ? `(${stats.size} bytes)` : '';
        results.push(`${type} ${item} ${size}`.trim());
      });

      if (results.length === 0) {
        return `Directory "${absolutePath}" is empty.`;
      }

      return results.join('\n');
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error listing directory "${absolutePath}": ${error.message}`);
    }
  }
});

// Tool 9: search_directory
server.addTool({
  name: 'search_directory',
  description: 'Search for regex patterns across all files in a directory.',
  parameters: z.object({
    directory_path: z.string().describe('Absolute path to the directory to search'),
    regexp: z.string().describe('Regular expression pattern to search for'),
    recursive: z.boolean().optional().default(false).describe('Search recursively in subdirectories'),
    lines_before: z.number().int().min(0).optional().describe('Number of lines to show before each match'),
    lines_after: z.number().int().min(0).optional().describe('Number of lines to show after each match'),
    include: z.string().optional().describe('Glob pattern for files to include (e.g., "*.ts", "*.js")'),
    exclude: z.string().optional().describe('Glob pattern for files/directories to exclude')
  }),
  execute: async ({ directory_path, regexp, recursive, lines_before, lines_after, include, exclude }) => {
    const absolutePath = validateAbsolutePath(directory_path, 'directory_path');
    validateDirectoryExists(absolutePath);

    try {
      const regex = new RegExp(regexp);
      const results: string[] = [];
      let totalMatches = 0;

      function searchInFile(filePath: string): void {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          const fileMatches: string[] = [];

          lines.forEach((line, index) => {
            if (regex.test(line)) {
              const lineNumber = index + 1;
              const startLine = Math.max(1, lineNumber - (lines_before || 0));
              const endLine = Math.min(lines.length, lineNumber + (lines_after || 0));

              const contextLines = lines.slice(startLine - 1, endLine);
              const context = contextLines.map((ctxLine, ctxIndex) => {
                const ctxLineNumber = startLine + ctxIndex;
                const marker = ctxLineNumber === lineNumber ? '>' : ' ';
                return `${marker} ${ctxLineNumber} | ${ctxLine}`;
              }).join('\n');

              fileMatches.push(`Match at line ${lineNumber}:\n${context}`);
              totalMatches++;
            }
          });

          if (fileMatches.length > 0) {
            results.push(`File: ${filePath}\n${fileMatches.join('\n\n')}`);
          }
        } catch (error: any) {
          // Skip files that can't be read
          results.push(`Warning: Could not read file ${filePath}: ${error.message}`);
        }
      }

      function matchesPattern(filename: string, pattern?: string): boolean {
        if (!pattern) return true;
        // Simple glob matching (could be enhanced with a proper glob library)
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`).test(filename);
      }

      function searchDirectory(dirPath: string): void {
        const items = fs.readdirSync(dirPath);

        items.forEach(item => {
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            if (recursive && !(exclude && matchesPattern(item, exclude))) {
              searchDirectory(itemPath);
            }
          } else if (stats.isFile()) {
            const includeMatch = !include || matchesPattern(item, include);
            const excludeMatch = exclude && matchesPattern(item, exclude);
            if (includeMatch && !excludeMatch) {
              searchInFile(itemPath);
            }
          }
        });
      }

      searchDirectory(absolutePath);

      if (totalMatches === 0) {
        return `No matches found for pattern "${regexp}" in directory "${absolutePath}".`;
      }

      return `Found ${totalMatches} match(es) in ${results.length} file(s):\n\n${results.join('\n\n')}`;
    } catch (error: any) {
      if (error instanceof UserError) throw error;
      throw new UserError(`Error searching directory "${absolutePath}": ${error.message}`);
    }
  }
});

// Only start the server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    process.on('SIGINT', async () => {
        process.exit(0);
    });

    process.stdout.on('error', (err) => {
        if (err.code === 'EPIPE') {
            process.exit(0);
        } else {
            throw err;
        }
    });

    server.start({ transportType: 'stdio' });
}

// Export server for testing
export { server };
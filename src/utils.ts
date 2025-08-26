import { UserError } from 'fastmcp';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Validates that the provided path is absolute and provides helpful error messages for LLMs
 * @param filePath The path to validate
 * @param parameterName The name of the parameter for error messages
 * @returns The validated absolute path
 * @throws UserError if the path is not absolute
 */
export function validateAbsolutePath(filePath: string, parameterName: string = 'path'): string {
  if (!path.isAbsolute(filePath)) {
    throw new UserError(
      `The ${parameterName} must be an absolute path. You provided a relative path: "${filePath}". ` +
      `Please provide the full absolute path (e.g., "/home/user/file.txt" on Linux/Mac or "C:\\Users\\user\\file.txt" on Windows).`
    );
  }
  return filePath;
}

/**
 * Validates that a file exists and is accessible for reading
 * @param filePath The absolute path to the file
 * @throws UserError if the file doesn't exist or isn't accessible
 */
export function validateFileExists(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new UserError(
        `The path "${filePath}" exists but is not a file. Please ensure you're providing the path to a file, not a directory.`
      );
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new UserError(
        `File not found: "${filePath}". Please verify that the file exists and the path is correct.`
      );
    } else if (error.code === 'EACCES') {
      throw new UserError(
        `Permission denied: Cannot access "${filePath}". Please check file permissions.`
      );
    } else {
      throw new UserError(
        `Error accessing file "${filePath}": ${error.message}`
      );
    }
  }
}

/**
 * Validates that a directory exists and is accessible
 * @param dirPath The absolute path to the directory
 * @throws UserError if the directory doesn't exist or isn't accessible
 */
export function validateDirectoryExists(dirPath: string): void {
  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw new UserError(
        `The path "${dirPath}" exists but is not a directory. Please ensure you're providing the path to a directory.`
      );
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new UserError(
        `Directory not found: "${dirPath}". Please verify that the directory exists and the path is correct.`
      );
    } else if (error.code === 'EACCES') {
      throw new UserError(
        `Permission denied: Cannot access directory "${dirPath}". Please check directory permissions.`
      );
    } else {
      throw new UserError(
        `Error accessing directory "${dirPath}": ${error.message}`
      );
    }
  }
}

/**
 * Verifies that the content at a specific line matches the expected content (ignoring whitespace differences)
 * @param filePath The absolute path to the file
 * @param lineNumber The line number to check (1-based)
 * @param expectedContent The expected content of the line
 * @returns The actual content of the line if verification passes
 * @throws UserError if the content doesn't match or line doesn't exist
 */
export function verifyLineContent(filePath: string, lineNumber: number, expectedContent: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new UserError(
        `Line ${lineNumber} does not exist in file "${filePath}". The file has ${lines.length} lines. ` +
        `Please verify the line number and re-read the file with show_line_numbers=true to see the current content.`
      );
    }

    const actualContent = lines[lineNumber - 1]; // Convert to 0-based index
    const normalizedActual = actualContent.trim().replace(/\s+/g, ' ');
    const normalizedExpected = expectedContent.trim().replace(/\s+/g, ' ');

    if (normalizedActual !== normalizedExpected) {
      throw new UserError(
        `Line content verification failed for line ${lineNumber} in "${filePath}".\n` +
        `Expected (normalized): "${normalizedExpected}"\n` +
        `Actual (normalized): "${normalizedActual}"\n` +
        `Please re-read the file with show_line_numbers=true to see the current content and update your request accordingly.`
      );
    }

    return actualContent;
  } catch (error) {
    if (error instanceof UserError) {
      throw error;
    }
    throw new UserError(
      `Error reading file "${filePath}" for line verification: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Normalizes content for comparison by trimming whitespace and collapsing multiple spaces
 * @param content The content to normalize
 * @returns Normalized content
 */
export function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ');
}
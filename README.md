# MCP File Editor Server

A comprehensive Model Context Protocol (MCP) server that provides advanced file operations for reading, writing, searching, and editing files. This server offers 8 powerful tools for file manipulation with robust error handling and comprehensive test coverage.

## Features

### Core Tools

1. **`read_file`** - Read file contents with flexible options
   - Full file reading or specific line ranges
   - Optional line number prefixes
   - Support for partial file reading

2. **`replace_in_file`** - Regex-based string replacement
   - Single or multiple occurrence replacement
   - Complex regex pattern support
   - Safe replacement with occurrence limits

3. **`delete_from_file`** - Remove content between line numbers
   - Line content verification for safety
   - Single or multi-line deletion
   - Precise line range targeting

4. **`insert_into_file`** - Insert content at specific positions
   - Before/after line placement
   - End-of-file appending
   - Line content verification

5. **`replace_lines_in_file`** - Replace content between lines
   - Multi-line content replacement
   - Line content verification
   - Flexible content insertion

6. **`search_file`** - Search within individual files
   - Regex pattern matching
   - Context lines (before/after)
   - Detailed match reporting

7. **`list_files`** - Directory content listing
   - File and directory enumeration
   - File size information
   - Recursive directory support

8. **`search_directory`** - Search across multiple files
   - Directory-wide regex search
   - Include/exclude pattern filtering
   - Recursive subdirectory searching

### Key Features

- **Robust Error Handling**: User-friendly error messages with actionable guidance
- **Path Validation**: Absolute path enforcement with helpful error messages
- **Content Verification**: Line content verification to prevent accidental edits
- **Comprehensive Testing**: 73 test cases covering all functionality
- **TypeScript Implementation**: Full type safety and modern JavaScript features
- **FastMCP Framework**: Built on the FastMCP library for optimal performance

## Installation

### Prerequisites

- Node.js 16.x or later
- npm or yarn package manager

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

## Usage

### Cursor-compatible MCP server config

```json
"mcpServers": {
   "file-edit": {
      "command": "npx",
      "args": ["mcp-file-editor@latest"]
   }
}
```

### Starting the Server

```bash
node build/index.js
```

The server will start and listen for MCP client connections via stdio transport.

### MCP Client Integration

This server is designed to work with MCP-compatible clients. The server communicates via stdio and supports the following MCP tools:

#### Example Tool Usage

```javascript
// Read a file
const result = await client.callTool({
  name: 'read_file',
  arguments: {
    file_path: '/absolute/path/to/file.txt',
    show_line_numbers: true,
    start_line: 1,
    end_line: 10
  }
});

// Search for patterns
const searchResult = await client.callTool({
  name: 'search_directory',
  arguments: {
    directory_path: '/path/to/search',
    regexp: 'TODO|FIXME',
    recursive: true
  }
});
```

## Testing

Run the comprehensive test suite:

```bash
npm test
```

The test suite includes:

- **73 total tests** across 4 test files
- Unit tests for all 8 tools
- Error handling validation
- Edge case coverage
- Integration testing with MCP client

### Test Coverage

- `read-file.test.ts` - 16 tests for file reading operations
- `editing-tools.test.ts` - 19 tests for file modification tools
- `search-tools.test.ts` - 22 tests for search and directory operations
- `utils.test.ts` - 16 tests for utility functions

## API Reference

### Tool Parameters

#### read_file

- `file_path` (string, required): Absolute path to the file
- `show_line_numbers` (boolean, optional): Prefix lines with numbers
- `start_line` (number, optional): Starting line number (1-based)
- `end_line` (number, optional): Ending line number (1-based)
- `full` (boolean, optional): Read entire file (mutually exclusive with line ranges)

#### replace_in_file

- `file_path` (string, required): Absolute path to the file
- `regex_source` (string, required): Regular expression pattern
- `target` (string, required): Replacement string
- `multiple` (boolean, optional): Allow multiple replacements

#### delete_from_file

- `file_path` (string, required): Absolute path to the file
- `line_start` (number, required): Starting line number
- `line_end` (number, required): Ending line number
- `line_start_contents` (string, required): Expected content of starting line

#### insert_into_file

- `file_path` (string, required): Absolute path to the file
- `line_number` (number, required): Target line number (0 for end)
- `line_contents` (string, required): Expected content of target line
- `where` (enum, required): 'before' or 'after'
- `contents` (string, required): Content to insert

#### replace_lines_in_file

- `file_path` (string, required): Absolute path to the file
- `line_start` (number, required): Starting line number
- `line_end` (number, required): Ending line number
- `line_start_contents` (string, required): Expected content of starting line
- `contents` (string, required): Replacement content

#### search_file

- `file_path` (string, required): Absolute path to the file
- `regexp` (string, required): Regular expression pattern
- `lines_before` (number, optional): Context lines before matches
- `lines_after` (number, optional): Context lines after matches

#### list_files

- `directory_path` (string, required): Absolute path to the directory

#### search_directory

- `directory_path` (string, required): Absolute path to the directory
- `regexp` (string, required): Regular expression pattern
- `recursive` (boolean, optional): Search subdirectories
- `lines_before` (number, optional): Context lines before matches
- `lines_after` (number, optional): Context lines after matches
- `include` (string, optional): File pattern to include
- `exclude` (string, optional): File/directory pattern to exclude

## Error Handling

The server provides detailed error messages for common issues:

- **Path validation**: Clear messages for relative paths and non-existent files
- **Content verification**: Helpful guidance when line content doesn't match
- **File operations**: Descriptive errors for read/write failures
- **Parameter validation**: Specific guidance for invalid parameters

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Architecture

The server is built with:

- **TypeScript** for type safety and modern JavaScript features
- **FastMCP** framework for MCP protocol implementation
- **Zod** for schema validation
- **Vitest** for comprehensive testing
- **fs-extra** for enhanced file system operations

The architecture follows clean separation of concerns with:

- Main server implementation in `src/index.ts`
- Utility functions in `src/utils.ts`
- Comprehensive test suite with proper MCP client integration
- Modular tool implementations with consistent error handling

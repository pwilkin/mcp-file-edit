import * as fs from 'fs-extra';
import * as path from 'path';
import { beforeAll, afterAll } from 'vitest';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Create a temporary test directory structure
const TEST_DIR = path.join(process.cwd(), 'test-temp');
const TEST_FILES = {
  simple: path.join(TEST_DIR, 'simple.txt'),
  multiline: path.join(TEST_DIR, 'multiline.txt'),
  code: path.join(TEST_DIR, 'code.py'),
  config: path.join(TEST_DIR, 'config.json'),
  nested: path.join(TEST_DIR, 'nested', 'file.txt'),
  subdir: path.join(TEST_DIR, 'subdir')
};

let client: Client;
let setupComplete = false;

// Synchronous file creation function
function createTestFiles() {
  try {
    // Create test directory structure synchronously
    fs.ensureDirSync(TEST_DIR);
    fs.ensureDirSync(TEST_FILES.subdir);
    fs.ensureDirSync(path.dirname(TEST_FILES.nested));

    // Create test files synchronously
    fs.writeFileSync(TEST_FILES.simple, 'Hello, World!\nThis is a simple test file.');

    fs.writeFileSync(TEST_FILES.multiline, `Line 1: First line
Line 2: Second line
Line 3: Third line with some text
Line 4: Fourth line
Line 5: Fifth line
Line 6: Sixth line
Line 7: Seventh line
Line 8: Eighth line
Line 9: Ninth line
Line 10: Tenth line`);

    fs.writeFileSync(TEST_FILES.code, `def hello_world():
    print("Hello, World!")

def calculate_sum(a, b):
    return a + b

class Calculator:
    def add(self, x, y):
        return x + y

# This is a comment
if __name__ == "__main__":
    hello_world()`);

    fs.writeFileSync(TEST_FILES.config, `{
  "name": "test-config",
  "version": "1.0.0",
  "settings": {
    "debug": true,
    "timeout": 5000
  },
  "features": ["feature1", "feature2"]
}`);

    fs.writeFileSync(TEST_FILES.nested, 'This is a file in a nested directory.');
  } catch (error) {
    console.error('Error creating test files:', error);
    throw error;
  }
}

beforeAll(async () => {
  // Only run setup once across all test files
  if (setupComplete) {
    console.log('Test setup: Already completed, skipping...');
    return;
  }

  console.log('Test setup: Starting...');
  console.log('Test directory:', TEST_DIR);
  console.log('Current working directory:', process.cwd());

  // Clean up any existing test directory
  try {
    fs.removeSync(TEST_DIR);
    console.log('Cleaned up existing test directory');
  } catch (error) {
    // Ignore if directory doesn't exist
  }

  // Create test files synchronously
  console.log('Creating test files...');
  createTestFiles();

  // Verify files were created
  if (!fs.existsSync(TEST_FILES.simple)) {
    throw new Error(`Test file not created: ${TEST_FILES.simple}`);
  }

  console.log('Test files created successfully');
  console.log('Files exist check:', {
    simple: fs.existsSync(TEST_FILES.simple),
    multiline: fs.existsSync(TEST_FILES.multiline),
    code: fs.existsSync(TEST_FILES.code),
    config: fs.existsSync(TEST_FILES.config),
    nested: fs.existsSync(TEST_FILES.nested)
  });

  // Create MCP client and transport (this will start the server)
  const transport = new StdioClientTransport({
    command: "node",
    args: ["build/index.js"],
    cwd: process.cwd()
  });

  client = new Client(
    {
      name: "test-client",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  // Connect to the server (this will start the server process)
  await client.connect(transport);

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 500));

  setupComplete = true;
  console.log('Test setup: Completed successfully');
}, 30000);

afterAll(async () => {
  // Clean up
  if (client) {
    await client.close();
  }
  // Only clean up if this is the last test file to finish
  // For now, we'll leave the cleanup to be done manually or by the test runner
  // try {
  //   fs.removeSync(TEST_DIR);
  // } catch (error) {
  //   // Ignore cleanup errors
  // }
});

// Export test files and client for use in tests
export { TEST_DIR, TEST_FILES, client };
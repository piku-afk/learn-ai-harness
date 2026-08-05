import { createInterface } from 'node:readline/promises';
import { access, unlink, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MODEL, REQUEST_URL } from '../shared/constants.js';

const SYSTEM_INSTRUCTION =
  'you are a coding agent. implement whatever user asks you to develop **only using the available tools**. you will **only modify files/folder inside `<project-root>/apps/mini-coding-agent/sandbox/` folder**.';

async function list_files({ folder_path }: { folder_path: string }): Promise<string> {
  try {
    const result: string[] = [];
    const entries = await readdir(folder_path, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(folder_path, entry.name);

      if (entry.isDirectory()) {
        result.push(`Folder: ${entry.name} (${fullPath})`);
      } else if (entry.isFile()) {
        result.push(`File: ${entry.name} (${fullPath})`);
      }
    }

    return result.join('\n');
  } catch (err) {
    return 'Error reading the directory: ' + err;
  }
}

async function read_file({ file_path }: { file_path: string }) {
  try {
    const data = await readFile(file_path, 'utf-8');
    return data;
  } catch (err) {
    return 'Error reading file: ' + err;
  }
}

async function write_file({ file_path, content }: { file_path: string; content: string }) {
  try {
    let existedBefore = true;
    try {
      await access(file_path);
    } catch {
      existedBefore = false; // file didn't exist
    }

    await writeFile(file_path, content, { encoding: 'utf-8', flag: '' });

    return existedBefore ? 'File was updated' : 'File was created';
  } catch (err) {
    return 'Error writing file: ' + err;
  }
}

async function delete_file({ file_path }: { file_path: string }) {
  try {
    await unlink(file_path);
    return 'file deleted successfully';
  } catch (err) {
    return 'Error deleting file: ' + err;
  }
}

async function log_context() {
  return messages;
}

async function clear_context() {
  messages.length = 0;
  return 'context cleared';
}

const tools = [
  {
    type: 'function',
    name: 'list_files',
    description: 'call this when you want to read the contents of a folder',
    parameters: {
      type: 'object',
      properties: {
        folder_path: {
          type: 'string',
          description:
            'the path for the folder whose content you want to read. the path should be with respect to <project root>',
        },
      },
      required: ['folder_path'],
    },
  },
  {
    type: 'function',
    name: 'read_file',
    description: 'call this when you want to read the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description:
            'the path for the file whose content you want to read. the path should be with respect to <project root>',
        },
      },
      required: ['file_path'],
    },
  },
  {
    type: 'function',
    name: 'write_file',
    description: 'call this when you want to rewrite the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description:
            'the path for the file whose content you want to read. the path should be with respect to <project root>',
        },
        content: { type: 'string', description: 'the new contents of the file' },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    type: 'function',
    name: 'delete_file',
    description: 'call this when you want to delete a file',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description:
            'the path for the file which you want to remove. the path should be with respect to <project root>',
        },
      },
      required: ['file_path'],
    },
  },
  {
    type: 'function',
    name: 'log_context',
    description: 'call this when user asks to log the context of the conversation',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'clear_context',
    description: 'call this when user asks to clear the context of the conversation',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
] as const;
const agentConfig = {
  tools,
  store: false,
  model: MODEL,
  system_instruction: SYSTEM_INSTRUCTION,
  generation_config: { tool_choice: 'validated' },
};

const messages: Array<any> = [];

async function callTool(toolName: string, toolArgs: any) {
  switch (toolName) {
    case 'list_files':
      return await list_files(toolArgs);
    case 'read_file':
      return read_file(toolArgs);
    case 'write_file':
      return write_file(toolArgs);
    case 'delete_file':
      return delete_file(toolArgs);
    case 'log_context':
      return log_context();
    case 'clear_context':
      return clear_context();
  }
}

async function callModel(messages: Readonly<Array<any>>) {
  const response = await fetch(REQUEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': process.env.GOOGLE_API_KEY!,
    },
    body: JSON.stringify({
      ...agentConfig,
      input: messages,
    }),
  });

  const data = await response.json();

  if (data.error && data.error.message) {
    return { status: 'failed', error: data.error.message };
  }

  const { status, steps } = data;
  return { status, steps };
}

async function callModelLoop(messages: Array<any>) {
  for (let i = 0; i < 5; i++) {
    const { status, steps, error } = await callModel(messages);

    if (status === 'failed') {
      console.log(error);
      return;
    }

    if (status === 'completed') {
      const content = steps.at(1).content.at(0).text;
      console.log(content, '\n');
      return;
    }

    messages.push(...steps);

    for (const step of steps.slice(1)) {
      console.log(`${step.name}(${JSON.stringify(step.arguments)})`);
      const result = await callTool(step.name, step.arguments);

      messages.push({
        type: 'function_result',
        name: step.name,
        call_id: step.id,
        result: [{ type: 'text', text: JSON.stringify(result) }],
      });
    }
  }
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  rl.on('close', () => {
    console.log('\nExiting...');
    process.exit(0);
  });

  try {
    while (true) {
      const userInput = await rl.question('mini-coding-agent>');
      messages.push({ type: 'user_input', content: [{ type: 'text', text: userInput }] });
      await callModelLoop(messages);
    }
  } finally {
    rl.close();
  }
}

main();

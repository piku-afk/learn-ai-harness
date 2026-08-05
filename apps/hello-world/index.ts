import readline from 'node:readline';
import { MODEL, REQUEST_URL } from '../shared/constants.js';

const tools = [
  {
    type: 'function',
    name: 'greet_user',
    description: 'call this when you want to greet the user',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "user's name" },
      },
      required: ['name'],
    },
  },
  {
    type: 'function',
    name: 'unknown_tool',
    description: 'call this when your cannot match any tool',
    parameters: {},
  },
] as const;

const agentConfig = {
  tools,
  store: false,
  model: MODEL,
  generation_config: { tool_choice: 'validated' },
};

const messages: Array<any> = [];

function greetUser({ name }: { name: string }) {
  return `Hey ${name}! how are you?`;
}

function unknownTool() {
  return 'Command not understood';
}

function callTool(name: string, args: any) {
  switch (name) {
    case 'greet_user':
      return greetUser(args);
    default:
      return unknownTool();
  }
}

async function callModel() {
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

  if (data.status === 'requires_action') {
    messages.push(...data.steps);
    return data.steps.at(-1);
  }

  if (data.status === 'completed') {
    return data.steps.at(-1).content[0].text;
  }

  return data.error.message;
}

async function callModelLoop(userInput: string) {
  messages.push({
    type: 'user_input',
    content: [{ type: 'text', text: userInput }],
  });

  for (let i = 0; i < 5; i++) {
    const message = await callModel();

    if (typeof message === 'string') {
      console.log(message);
      return;
    }

    console.log('calling:', message.name, message.arguments);
    const result = callTool(message.name, message.arguments);
    messages.push({
      type: 'function_result',
      name: message.name,
      call_id: message.id,
      result: [{ type: 'text', text: JSON.stringify(result) }],
    });
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('close', () => {
  console.log('\nExiting...');
  process.exit(0);
});

function askUser(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  while (true) {
    const input = await askUser('Input: ');
    await callModelLoop(input);
    // deleting context
    messages.length = 0;
  }
}

main();

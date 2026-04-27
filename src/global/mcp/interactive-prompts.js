import readline from 'node:readline/promises';

export function isInteractiveIo(io) {
  return io?.stdin?.isTTY === true && io?.stdout?.isTTY === true;
}

export function createPromptAdapter(io) {
  return {
    isInteractive: isInteractiveIo(io),
    async promptLine(message) {
      const rl = readline.createInterface({ input: io.stdin, output: io.stdout });
      try {
        return await rl.question(message);
      } finally {
        rl.close();
      }
    },
    async promptSecret(message) {
      return promptHiddenSecret(message, io);
    },
    close() {},
  };
}

export async function promptHiddenSecret(message, io) {
  const stdin = io?.stdin;
  const stdout = io?.stdout;
  if (!stdin?.isTTY || !stdout?.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Hidden secret input is unavailable in this terminal. Use openkit configure mcp set-key <mcp-id> --stdin.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = stdin.isRaw === true;

    const cleanup = () => {
      stdin.off('data', onData);
      if (!wasRaw) {
        stdin.setRawMode(false);
      }
      stdin.pause();
    };

    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      if (text === '\u0003') {
        cleanup();
        stdout.write('\n');
        reject(new Error('Secret entry cancelled.'));
        return;
      }
      if (text === '\r' || text === '\n' || text === '\r\n') {
        cleanup();
        stdout.write('\n');
        resolve(value);
        return;
      }
      if (text === '\u007f' || text === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += text;
    };

    try {
      stdout.write(message);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onData);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function normalizePromptAnswer(value) {
  return String(value ?? '').trim();
}

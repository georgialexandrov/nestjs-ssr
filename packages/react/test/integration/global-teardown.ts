import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const PROCESS_FILE = join(__dirname, '.test-processes.json');
const SERVER_STDERR_FILE = join(__dirname, '.test-server-stderr.log');
const FATAL_SERVER_ERROR =
  /ERR_HTTP_HEADERS_SENT|UnhandledPromiseRejection|uncaughtException|\[ExceptionsHandler\]|process (?:error|exited with code [1-9])/i;

interface ProcessInfo {
  pid: number;
  name: string;
  type: 'nest' | 'vite';
}

function killProcess(pid: number): boolean {
  try {
    // Kill the process group (negative PID)
    process.kill(-pid, 'SIGTERM');
    return true;
  } catch {
    try {
      // Fallback to killing just the process
      process.kill(pid, 'SIGTERM');
      return true;
    } catch {
      return false;
    }
  }
}

async function globalTeardown() {
  console.log('\n🛑 Stopping test servers...\n');

  if (existsSync(PROCESS_FILE)) {
    try {
      const content = readFileSync(PROCESS_FILE, 'utf-8');
      const processes: ProcessInfo[] = JSON.parse(content);

      for (const proc of processes) {
        const killed = killProcess(proc.pid);
        if (killed) {
          console.log(
            `   ✓ Stopped ${proc.type} for ${proc.name} (PID: ${proc.pid})`,
          );
        } else {
          console.log(
            `   ⚠ Could not stop ${proc.type} for ${proc.name} (PID: ${proc.pid})`,
          );
        }
      }

      // Clean up process file
      unlinkSync(PROCESS_FILE);
    } catch (error) {
      console.error('   Failed to read process file:', error);
    }
  } else {
    console.log('   No process file found, skipping process cleanup');
  }

  // Give processes time to cleanup
  await new Promise((r) => setTimeout(r, 2000));

  const serverStderr = existsSync(SERVER_STDERR_FILE)
    ? readFileSync(SERVER_STDERR_FILE, 'utf-8')
    : '';
  if (existsSync(SERVER_STDERR_FILE)) unlinkSync(SERVER_STDERR_FILE);

  if (FATAL_SERVER_ERROR.test(serverStderr)) {
    throw new Error(`Fixture server emitted a fatal error:\n${serverStderr}`);
  }

  console.log('\n✅ Teardown complete\n');
}

export default globalTeardown;

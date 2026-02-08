import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const PROCESS_FILE = join(__dirname, '.test-processes.json');

interface ProcessInfo {
  pid: number;
  name: string;
  type: 'nest' | 'vite';
}

function killProcess(pid: number): boolean {
  try {
    process.kill(-pid, 'SIGTERM');
    return true;
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch {
      return false;
    }
  }
}

async function globalTeardown() {
  console.log('\n🛑 Stopping E2E test servers...\n');

  if (!existsSync(PROCESS_FILE)) {
    console.log('   No process file found, skipping teardown');
    return;
  }

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

    unlinkSync(PROCESS_FILE);
  } catch (error) {
    console.error('   Failed to read process file:', error);
  }

  await new Promise((r) => setTimeout(r, 2000));

  console.log('\n✅ E2E teardown complete\n');
}

export default globalTeardown;

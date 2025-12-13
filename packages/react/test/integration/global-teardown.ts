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

    // Clean up process file
    unlinkSync(PROCESS_FILE);
  } catch (error) {
    console.error('   Failed to read process file:', error);
  }

  // Give processes time to cleanup
  await new Promise((r) => setTimeout(r, 2000));

  console.log('\n✅ Teardown complete\n');
}

export default globalTeardown;

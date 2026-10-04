/**
 * Preloaded into the example server by test/perf/http.ts (via --require).
 *
 * Wall-clock throughput depends on everything else the machine is doing;
 * CPU time spent by the server process per request mostly does not. This
 * answers GET / on PERF_CPU_PORT with the process's cumulative CPU time in
 * microseconds, so the harness can difference it around each load run.
 */
'use strict';

const { createServer } = require('http');

const port = Number(process.env.PERF_CPU_PORT);
if (port) {
  const server = createServer((_request, response) => {
    const { user, system } = process.cpuUsage();
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ micros: user + system }));
  });
  server.listen(port, '127.0.0.1');
  server.unref();
}

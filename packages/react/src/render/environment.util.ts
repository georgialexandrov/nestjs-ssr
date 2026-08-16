import type { Logger } from '@nestjs/common';

let environmentOverride: 'development' | 'production' | null = null;
let warnedAboutUnsetNodeEnv = false;

/**
 * Explicitly set the runtime environment, taking precedence over NODE_ENV.
 * Called by RenderModule when the `environment` config option is provided,
 * giving deployments that cannot control NODE_ENV an explicit switch.
 */
export function setEnvironmentOverride(
  environment: 'development' | 'production',
): void {
  environmentOverride = environment;
}

/**
 * Whether the app is running in development mode.
 *
 * The `environment` config option wins when set. Otherwise development mode
 * requires NODE_ENV to say so explicitly.
 *
 * This is fail-closed on purpose. Development mode installs the Vite dev
 * proxy (which serves project sources, including Vite's `/@fs/` endpoint)
 * and renders error pages containing stack traces. Treating an *unset*
 * NODE_ENV as development — as this used to — meant any deployment that
 * forgot the variable silently shipped both. The cost is that a developer
 * whose dev command does not set NODE_ENV now has to; warnIfNodeEnvUnset()
 * makes that visible at startup.
 */
export function isDevelopmentEnv(): boolean {
  if (environmentOverride) {
    return environmentOverride === 'development';
  }
  return process.env.NODE_ENV === 'development';
}

/**
 * Log a prominent warning (once per process) when the environment is not
 * explicitly configured. An unset NODE_ENV runs the production pipeline,
 * which expects a built client bundle — a developer who lands here usually
 * meant to be in development mode.
 */
export function warnIfNodeEnvUnset(logger: Logger): void {
  if (environmentOverride || process.env.NODE_ENV || warnedAboutUnsetNodeEnv) {
    return;
  }
  warnedAboutUnsetNodeEnv = true;
  logger.warn(
    'NODE_ENV is not set - running in PRODUCTION mode, which serves the ' +
      'prebuilt client bundle and hides error details. For local development ' +
      "set NODE_ENV=development or pass RenderModule.forRoot({ environment: 'development' }).",
  );
}

/** Test-only helper to reset the override and warn-once state. */
export function resetEnvironmentForTests(): void {
  environmentOverride = null;
  warnedAboutUnsetNodeEnv = false;
}

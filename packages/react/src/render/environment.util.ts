import type { Logger } from '@nestjs/common';

let environmentOverride: 'development' | 'production' | null = null;
let warnedAboutUnsetNodeEnv = false;

/**
 * Explicitly set the runtime environment, taking precedence over NODE_ENV.
 * Called by RenderModule when the `environment` config option is provided,
 * giving deployments that cannot control NODE_ENV a fail-closed switch.
 */
export function setEnvironmentOverride(
  environment: 'development' | 'production',
): void {
  environmentOverride = environment;
}

/**
 * Whether the app is running in development mode.
 *
 * The `environment` config option wins when set. Otherwise this
 * intentionally treats an *unset* NODE_ENV as development to keep the
 * zero-config dev experience, but that is a fail-open default: a production
 * deployment that forgets to set NODE_ENV gets the Vite dev pipeline
 * (source proxying, stack traces in error pages). Callers should pair this
 * with warnIfNodeEnvUnset() so the misconfiguration is visible.
 */
export function isDevelopmentEnv(): boolean {
  if (environmentOverride) {
    return environmentOverride === 'development';
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * Log a prominent warning (once per process) when the environment is not
 * explicitly configured. Running with an unset NODE_ENV enables development
 * behavior: the Vite dev-server proxy (which exposes project sources) and
 * detailed error pages.
 */
export function warnIfNodeEnvUnset(logger: Logger): void {
  if (environmentOverride || process.env.NODE_ENV || warnedAboutUnsetNodeEnv) {
    return;
  }
  warnedAboutUnsetNodeEnv = true;
  logger.warn(
    'NODE_ENV is not set - running in DEVELOPMENT mode. ' +
      'Development mode proxies project sources through the Vite dev server and ' +
      'exposes error stack traces. Set NODE_ENV=production or pass ' +
      "RenderModule.forRoot({ environment: 'production' }) for production deployments.",
  );
}

/** Test-only helper to reset the override and warn-once state. */
export function resetEnvironmentForTests(): void {
  environmentOverride = null;
  warnedAboutUnsetNodeEnv = false;
}

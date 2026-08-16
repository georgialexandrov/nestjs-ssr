import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Logger } from '@nestjs/common';
import {
  isDevelopmentEnv,
  setEnvironmentOverride,
  warnIfNodeEnvUnset,
  resetEnvironmentForTests,
} from '../environment.util';

describe('environment.util', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let logger: { warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    resetEnvironmentForTests();
    delete process.env.NODE_ENV;
    logger = { warn: vi.fn() };
  });

  afterEach(() => {
    resetEnvironmentForTests();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe('isDevelopmentEnv', () => {
    it('treats unset NODE_ENV as production (fail-closed default)', () => {
      // Development mode installs the Vite source proxy and renders stack
      // traces; a deployment that forgets NODE_ENV must not get either.
      expect(isDevelopmentEnv()).toBe(false);
    });

    it('treats NODE_ENV=development as development', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopmentEnv()).toBe(true);
    });

    it('treats NODE_ENV=production as production', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevelopmentEnv()).toBe(false);
    });

    it('treats an unrecognised NODE_ENV as production', () => {
      // "test", "staging", "qa" etc. are not development.
      process.env.NODE_ENV = 'test';
      expect(isDevelopmentEnv()).toBe(false);
    });

    it('lets the environment override win over an unset NODE_ENV', () => {
      setEnvironmentOverride('development');
      expect(isDevelopmentEnv()).toBe(true);
    });

    it('lets the environment override win over NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      setEnvironmentOverride('development');
      expect(isDevelopmentEnv()).toBe(true);
    });
  });

  describe('warnIfNodeEnvUnset', () => {
    it('warns once per process when NODE_ENV is unset', () => {
      warnIfNodeEnvUnset(logger as unknown as Logger);
      warnIfNodeEnvUnset(logger as unknown as Logger);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('does not warn when NODE_ENV is set', () => {
      process.env.NODE_ENV = 'production';
      warnIfNodeEnvUnset(logger as unknown as Logger);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('does not warn when the environment is explicitly configured', () => {
      setEnvironmentOverride('production');
      warnIfNodeEnvUnset(logger as unknown as Logger);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});

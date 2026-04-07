import { describe, it, expect } from 'vitest';
import {
  configureNestCliForSwc,
  getSwcRcConfig,
  type NestCliConfig,
} from '../swc-support';

describe('configureNestCliForSwc', () => {
  it('converts string "swc" builder to object with .tsx extensions', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {
        builder: 'swc',
        deleteOutDir: true,
      },
    };

    const result = configureNestCliForSwc(nestCli);

    expect(result.usesSwc).toBe(true);
    expect(result.updatedNestCli).not.toBeNull();
    expect(result.updatedNestCli!.compilerOptions!.builder).toEqual({
      type: 'swc',
      options: { extensions: ['.js', '.ts', '.tsx'] },
    });
    // Preserves other compilerOptions
    expect(result.updatedNestCli!.compilerOptions!.deleteOutDir).toBe(true);
  });

  it('adds .tsx to object builder without extensions', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {
        builder: { type: 'swc' },
      },
    };

    const result = configureNestCliForSwc(nestCli);

    expect(result.usesSwc).toBe(true);
    expect(result.updatedNestCli).not.toBeNull();
    const builder = result.updatedNestCli!.compilerOptions!.builder as {
      type: string;
      options: { extensions: string[] };
    };
    expect(builder.options.extensions).toEqual(['.js', '.ts', '.tsx']);
  });

  it('adds .tsx to object builder with existing extensions missing .tsx', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {
        builder: {
          type: 'swc',
          options: { extensions: ['.js', '.ts'] },
        },
      },
    };

    const result = configureNestCliForSwc(nestCli);

    expect(result.usesSwc).toBe(true);
    expect(result.updatedNestCli).not.toBeNull();
    const builder = result.updatedNestCli!.compilerOptions!.builder as {
      type: string;
      options: { extensions: string[] };
    };
    expect(builder.options.extensions).toEqual(['.js', '.ts', '.tsx']);
  });

  it('returns null when .tsx extension already present', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {
        builder: {
          type: 'swc',
          options: { extensions: ['.js', '.ts', '.tsx'] },
        },
      },
    };

    const result = configureNestCliForSwc(nestCli);

    expect(result.usesSwc).toBe(true);
    expect(result.updatedNestCli).toBeNull();
  });

  it('does not modify config when builder is tsc (default)', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {
        builder: 'tsc',
      },
    };

    const result = configureNestCliForSwc(nestCli);

    expect(result.usesSwc).toBe(false);
    expect(result.updatedNestCli).toBeNull();
  });

  it('does not modify config when no builder is set', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {},
    };

    const result = configureNestCliForSwc(nestCli);

    expect(result.usesSwc).toBe(false);
    expect(result.updatedNestCli).toBeNull();
  });

  it('does not modify config when no compilerOptions', () => {
    const nestCli: NestCliConfig = {};

    const result = configureNestCliForSwc(nestCli);

    expect(result.usesSwc).toBe(false);
    expect(result.updatedNestCli).toBeNull();
  });

  it('does not mutate the input object', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {
        builder: 'swc',
      },
    };
    const original = JSON.stringify(nestCli);

    configureNestCliForSwc(nestCli);

    expect(JSON.stringify(nestCli)).toBe(original);
  });

  it('preserves other builder options when adding extensions', () => {
    const nestCli: NestCliConfig = {
      compilerOptions: {
        builder: {
          type: 'swc',
          options: { copyFiles: true },
        },
      },
    };

    const result = configureNestCliForSwc(nestCli);
    const builder = result.updatedNestCli!.compilerOptions!.builder as {
      type: string;
      options: Record<string, unknown>;
    };

    expect(builder.options.copyFiles).toBe(true);
    expect(builder.options.extensions).toEqual(['.js', '.ts', '.tsx']);
  });
});

describe('getSwcRcConfig', () => {
  it('returns config with tsx parser enabled', () => {
    const config = getSwcRcConfig();
    const jsc = config.jsc as {
      parser: Record<string, unknown>;
      transform: Record<string, unknown>;
    };

    expect(jsc.parser.syntax).toBe('typescript');
    expect(jsc.parser.tsx).toBe(true);
    expect(jsc.parser.decorators).toBe(true);
  });

  it('uses automatic jsx runtime', () => {
    const config = getSwcRcConfig();
    const jsc = config.jsc as {
      transform: { react: { runtime: string } };
    };

    expect(jsc.transform.react.runtime).toBe('automatic');
  });
});

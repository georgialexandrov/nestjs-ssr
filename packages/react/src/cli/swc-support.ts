/**
 * SWC support helpers for the init CLI.
 *
 * NestJS's SWC builder defaults to compiling only .js and .ts files.
 * React views use .tsx, so we need to:
 * 1. Add .tsx to the extensions list in nest-cli.json builder options
 * 2. Create a .swcrc with tsx parser and react transform config
 */

export interface NestCliBuilder {
  type: string;
  options?: Record<string, unknown>;
}

export interface NestCliConfig {
  compilerOptions?: {
    builder?: string | NestCliBuilder;
    [key: string]: unknown;
  };
  exclude?: string[];
  [key: string]: unknown;
}

export interface SwcConfigResult {
  /** Whether the project uses SWC as its builder */
  usesSwc: boolean;
  /** The modified nest-cli.json config (only if changes were needed) */
  updatedNestCli: NestCliConfig | null;
}

const TSX_EXTENSIONS = ['.js', '.ts', '.tsx'];

/**
 * Detects SWC usage in nest-cli.json and adds .tsx extension support.
 * Returns the modified config if changes were needed, null otherwise.
 */
export function configureNestCliForSwc(
  nestCli: NestCliConfig,
): SwcConfigResult {
  const builder = nestCli.compilerOptions?.builder;

  const usesSwc =
    builder === 'swc' ||
    (typeof builder === 'object' && builder !== null && builder.type === 'swc');

  if (!usesSwc || !nestCli.compilerOptions) {
    return { usesSwc, updatedNestCli: null };
  }

  const result = structuredClone(nestCli);

  if (typeof builder === 'string') {
    // Convert string "swc" to object form with extensions
    result.compilerOptions!.builder = {
      type: 'swc',
      options: { extensions: TSX_EXTENSIONS },
    };
    return { usesSwc, updatedNestCli: result };
  }

  // Object form — check if extensions already include .tsx
  const existing = builder.options?.extensions as string[] | undefined;

  if (existing && existing.includes('.tsx')) {
    return { usesSwc, updatedNestCli: null };
  }

  const builderObj = result.compilerOptions!.builder as NestCliBuilder;
  if (!builderObj.options) {
    builderObj.options = {};
  }
  builderObj.options.extensions = TSX_EXTENSIONS;
  return { usesSwc, updatedNestCli: result };
}

/**
 * Returns the .swcrc content needed for TSX support.
 * NestJS deep-merges this with its hardcoded SWC defaults,
 * so we only need to specify the delta: tsx parser + react transform.
 */
export function getSwcRcConfig(): Record<string, unknown> {
  return {
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: true,
        decorators: true,
        dynamicImport: true,
      },
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  };
}

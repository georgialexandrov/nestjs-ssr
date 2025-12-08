import type { Plugin } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite plugin for @nestjs-ssr/react
 * Automatically configures the entry-client for SSR hydration
 */
export function nestjsSsrPlugin(): Plugin {
  const VIRTUAL_MODULE_ID = 'virtual:@nestjs-ssr/entry-client';
  const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;
  const DEV_ENTRY_PATH = '/@nestjs-ssr-entry-client.tsx';

  // Get the path to the entry-client template
  // When running from compiled dist, __dirname is packages/react/dist/vite
  // The templates are in packages/react/src/templates or packages/react/dist/templates
  const srcPath = resolve(__dirname, '../../src/templates/entry-client.tsx');
  const distPath = resolve(__dirname, '../templates/entry-client.tsx');

  const entryClientPath = existsSync(srcPath) ? srcPath : distPath;
  let entryClientContent: string;

  try {
    entryClientContent = readFileSync(entryClientPath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to load entry-client.tsx from ${entryClientPath}: ${error}`,
    );
  }

  return {
    name: '@nestjs-ssr/react',

    resolveId(id) {
      // In build mode, resolve the virtual module
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      // In dev mode, resolve the dev entry path
      if (id === DEV_ENTRY_PATH) {
        return DEV_ENTRY_PATH;
      }
      return null;
    },

    load(id) {
      // Load the entry-client content for both virtual module (build) and dev path
      if (id === RESOLVED_VIRTUAL_MODULE_ID || id === DEV_ENTRY_PATH) {
        return entryClientContent;
      }
      return null;
    },

    configureServer(server) {
      // Serve the entry-client file in development mode
      server.middlewares.use((req, res, next) => {
        if (req.url === DEV_ENTRY_PATH) {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(entryClientContent);
          return;
        }
        next();
      });
    },

    config(config) {
      return {
        build: {
          rollupOptions: {
            input: {
              client: VIRTUAL_MODULE_ID,
              // Preserve any existing inputs
              ...(typeof config.build?.rollupOptions?.input === 'object' &&
              !Array.isArray(config.build.rollupOptions.input)
                ? config.build.rollupOptions.input
                : {}),
            },
          },
        },
      };
    },
  };
}

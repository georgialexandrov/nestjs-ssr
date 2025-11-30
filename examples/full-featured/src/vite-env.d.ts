/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly glob: <T = any>(
    pattern: string,
    options?: { eager?: boolean }
  ) => Record<string, T>;
}

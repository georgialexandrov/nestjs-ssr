declare global {
  interface Window {
    __INITIAL_STATE__: any;
    __CONTEXT__: any;
    __COMPONENT_PATH__: string;
  }
}

export {};

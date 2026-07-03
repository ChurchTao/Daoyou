declare const Bun: {
  serve(options: {
    port: number;
    fetch: (request: Request, server: unknown) => Response | Promise<Response>;
    websocket?: unknown;
  }): unknown;
  spawn(command: string[], options: {
    stdout?: 'inherit';
    stderr?: 'inherit';
  }): {
    exited: Promise<number>;
    kill: () => void;
  };
};

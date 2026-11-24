declare module "@earendil-works/pi-coding-agent" {
  export interface ExtensionAPI {
    registerCommand(
      name: string,
      spec: { description: string; handler: (args: string, ctx: unknown) => unknown },
    ): void;
    on(event: string, handler: (event: any, ctx: any) => unknown): void;
    getActiveTools(): string[] | null;
    setActiveTools(tools: string[]): void;
    appendEntry(customType: string, data: unknown): void;
  }
}

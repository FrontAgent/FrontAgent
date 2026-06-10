// Minimal stand-in for the `vscode` module so vitest can load modules that
// import it. Tests mutate `__test` to control workspace state and inspect
// user-facing notifications.

interface StubWorkspaceFolder {
  uri: { fsPath: string };
  name: string;
  index: number;
}

export const __test = {
  workspaceFolders: undefined as StubWorkspaceFolder[] | undefined,
  settings: new Map<string, unknown>(),
  warnings: [] as string[],
  infos: [] as string[],
  reset(): void {
    this.workspaceFolders = undefined;
    this.settings.clear();
    this.warnings = [];
    this.infos = [];
  },
};

export const workspace = {
  get workspaceFolders(): StubWorkspaceFolder[] | undefined {
    return __test.workspaceFolders;
  },
  getConfiguration: () => ({
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      __test.settings.has(key) ? (__test.settings.get(key) as T) : defaultValue,
    update: async (): Promise<void> => {},
  }),
  openTextDocument: async (): Promise<unknown> => ({}),
};

export const window = {
  showWarningMessage: (message: string): void => {
    __test.warnings.push(message);
  },
  showInformationMessage: (message: string): void => {
    __test.infos.push(message);
  },
  showTextDocument: async (): Promise<void> => {},
};

export const commands = {
  executeCommand: async (): Promise<void> => {},
};

export const Uri = {
  file: (fsPath: string): { fsPath: string } => ({ fsPath }),
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

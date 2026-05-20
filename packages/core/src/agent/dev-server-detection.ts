export interface DevServerDetectionDeps {
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
}

export function detectDevServerPort(
  deps: DevServerDetectionDeps,
  collectedFiles: Map<string, string>,
): number {
  // 1. Check vite.config.ts/js
  for (const [filePath, content] of collectedFiles) {
    if (filePath.includes('vite.config')) {
      const portMatch = content.match(/server\s*:\s*\{[^}]*port\s*:\s*(\d+)/);
      if (portMatch) {
        deps.debugLog(`[Agent] 🔍 Detected port ${portMatch[1]} from ${filePath}`);
        return Number.parseInt(portMatch[1], 10);
      }
    }
  }

  // 2. Check package.json scripts
  const packageJson = collectedFiles.get('package.json');
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      const devScript = pkg.scripts?.dev || pkg.scripts?.start || '';

      const portMatch = devScript.match(/(?:--port|-p)\s+(\d+)/);
      if (portMatch) {
        deps.debugLog(`[Agent] 🔍 Detected port ${portMatch[1]} from package.json scripts`);
        return Number.parseInt(portMatch[1], 10);
      }

      const deps_ = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps_.vite) {
        deps.debugLog('[Agent] 🔍 Detected Vite project, using default port 5173');
        return 5173;
      }
      if (deps_.next) {
        deps.debugLog('[Agent] 🔍 Detected Next.js project, using default port 3000');
        return 3000;
      }
      if (deps_['react-scripts']) {
        deps.debugLog('[Agent] 🔍 Detected CRA project, using default port 3000');
        return 3000;
      }
      if (deps_['@angular/cli']) {
        deps.debugLog('[Agent] 🔍 Detected Angular project, using default port 4200');
        return 4200;
      }
      if (deps_.vue) {
        deps.debugLog('[Agent] 🔍 Detected Vue project, using default port 5173');
        return 5173;
      }
    } catch (error) {
      deps.debugWarn('[Agent] Failed to parse package.json for port detection:', error);
    }
  }

  // 3. Fallback
  deps.debugLog('[Agent] 🔍 Using fallback port 5173');
  return 5173;
}

import type {
  ModuleInfo,
  ProjectFacts,
  ProjectFactsMergeResult,
  ProjectFactsSnapshot,
  ProjectFactsUpdate,
} from '../types.js';
import { cloneStringArray, mapToRecord, recordToClonedStringArrayMap } from './helpers.js';

function addToSet(set: Set<string>, value: string): boolean {
  const before = set.size;
  set.add(value);
  return set.size !== before;
}

function removeFromSet(set: Set<string>, value: string): boolean {
  return set.delete(value);
}

function setStringArrayMap(map: Map<string, string[]>, key: string, value: string[]): boolean {
  const previous = map.get(key);
  if (
    previous &&
    previous.length === value.length &&
    previous.every((item, idx) => item === value[idx])
  ) {
    return false;
  }
  map.set(key, value);
  return true;
}

function cloneModuleInfo(moduleInfo: ModuleInfo): ModuleInfo {
  return {
    ...moduleInfo,
    exports: cloneStringArray(moduleInfo.exports),
    imports: cloneStringArray(moduleInfo.imports),
  };
}

export function exportProjectFactsSnapshot(facts: ProjectFacts): ProjectFactsSnapshot {
  const modulesRecord: Record<string, ModuleInfo> = {};
  for (const [path, moduleInfo] of facts.moduleDependencyGraph.modules.entries()) {
    modulesRecord[path] = cloneModuleInfo(moduleInfo);
  }

  return {
    revision: facts.revision,
    filesystem: {
      existingFiles: Array.from(facts.filesystem.existingFiles),
      existingDirectories: Array.from(facts.filesystem.existingDirectories),
      nonExistentPaths: Array.from(facts.filesystem.nonExistentPaths),
      directoryContents: mapToRecord(facts.filesystem.directoryContents, cloneStringArray),
    },
    dependencies: {
      installedPackages: Array.from(facts.dependencies.installedPackages),
      missingPackages: Array.from(facts.dependencies.missingPackages),
    },
    project: {
      devServerRunning: facts.project.devServerRunning,
      runningPort: facts.project.runningPort,
      buildStatus: facts.project.buildStatus,
    },
    moduleDependencyGraph: {
      modules: modulesRecord,
      dependencies: mapToRecord(facts.moduleDependencyGraph.dependencies, cloneStringArray),
      reverseDependencies: mapToRecord(
        facts.moduleDependencyGraph.reverseDependencies,
        cloneStringArray,
      ),
    },
    errors: facts.errors.map((error) => ({ ...error })),
  };
}

export function projectFactsFromSnapshot(snapshot: ProjectFactsSnapshot): ProjectFacts {
  const modulesMap = new Map<string, ModuleInfo>();
  for (const [path, moduleInfo] of Object.entries(snapshot.moduleDependencyGraph.modules)) {
    modulesMap.set(path, cloneModuleInfo(moduleInfo));
  }

  return {
    revision: snapshot.revision,
    filesystem: {
      existingFiles: new Set(snapshot.filesystem.existingFiles),
      existingDirectories: new Set(snapshot.filesystem.existingDirectories),
      nonExistentPaths: new Set(snapshot.filesystem.nonExistentPaths),
      directoryContents: recordToClonedStringArrayMap(snapshot.filesystem.directoryContents),
    },
    dependencies: {
      installedPackages: new Set(snapshot.dependencies.installedPackages),
      missingPackages: new Set(snapshot.dependencies.missingPackages),
    },
    project: {
      devServerRunning: snapshot.project.devServerRunning,
      runningPort: snapshot.project.runningPort,
      buildStatus: snapshot.project.buildStatus ?? 'unknown',
    },
    moduleDependencyGraph: {
      modules: modulesMap,
      dependencies: recordToClonedStringArrayMap(snapshot.moduleDependencyGraph.dependencies),
      reverseDependencies: recordToClonedStringArrayMap(
        snapshot.moduleDependencyGraph.reverseDependencies,
      ),
    },
    errors: snapshot.errors.map((error) => ({ ...error })),
  };
}

export function mergeProjectFactsUpdate(
  facts: ProjectFacts,
  update: ProjectFactsUpdate,
): ProjectFactsMergeResult {
  const previousRevision = facts.revision;
  const staleBaseRevision = update.baseRevision !== previousRevision;
  let changed = false;
  const { changes } = update;

  for (const path of changes.addExistingFiles ?? []) {
    changed = addToSet(facts.filesystem.existingFiles, path) || changed;
    changed = removeFromSet(facts.filesystem.nonExistentPaths, path) || changed;
  }

  for (const path of changes.addExistingDirectories ?? []) {
    changed = addToSet(facts.filesystem.existingDirectories, path) || changed;
    changed = removeFromSet(facts.filesystem.nonExistentPaths, path) || changed;
  }

  for (const path of changes.addNonExistentPaths ?? []) {
    changed = addToSet(facts.filesystem.nonExistentPaths, path) || changed;
    changed = removeFromSet(facts.filesystem.existingFiles, path) || changed;
  }

  for (const path of changes.removeNonExistentPaths ?? []) {
    changed = removeFromSet(facts.filesystem.nonExistentPaths, path) || changed;
  }

  for (const entry of changes.setDirectoryContents ?? []) {
    changed =
      setStringArrayMap(
        facts.filesystem.directoryContents,
        entry.path,
        cloneStringArray(entry.entries),
      ) || changed;
  }

  for (const pkg of changes.addInstalledPackages ?? []) {
    changed = addToSet(facts.dependencies.installedPackages, pkg) || changed;
    changed = removeFromSet(facts.dependencies.missingPackages, pkg) || changed;
  }

  for (const pkg of changes.addMissingPackages ?? []) {
    changed = addToSet(facts.dependencies.missingPackages, pkg) || changed;
  }

  for (const pkg of changes.removeMissingPackages ?? []) {
    changed = removeFromSet(facts.dependencies.missingPackages, pkg) || changed;
  }

  if (changes.project) {
    const nextProject = changes.project;
    if (
      nextProject.devServerRunning !== undefined &&
      facts.project.devServerRunning !== nextProject.devServerRunning
    ) {
      facts.project.devServerRunning = nextProject.devServerRunning;
      changed = true;
    }
    if (
      nextProject.runningPort !== undefined &&
      facts.project.runningPort !== nextProject.runningPort
    ) {
      facts.project.runningPort = nextProject.runningPort;
      changed = true;
    }
    if (
      nextProject.buildStatus !== undefined &&
      facts.project.buildStatus !== nextProject.buildStatus
    ) {
      facts.project.buildStatus = nextProject.buildStatus;
      changed = true;
    }
  }

  for (const moduleInfo of changes.upsertModules ?? []) {
    facts.moduleDependencyGraph.modules.set(moduleInfo.path, cloneModuleInfo(moduleInfo));
    changed = true;
  }

  for (const depEntry of changes.setDependencies ?? []) {
    facts.moduleDependencyGraph.dependencies.set(
      depEntry.path,
      cloneStringArray(depEntry.dependencies),
    );
    changed = true;
  }

  for (const reverseDepEntry of changes.setReverseDependencies ?? []) {
    facts.moduleDependencyGraph.reverseDependencies.set(
      reverseDepEntry.path,
      cloneStringArray(reverseDepEntry.reverseDependencies),
    );
    changed = true;
  }

  for (const error of changes.addErrors ?? []) {
    facts.errors.push({ ...error });
    changed = true;
  }

  if (changed) {
    facts.revision += 1;
  }

  return {
    applied: changed,
    staleBaseRevision,
    previousRevision,
    nextRevision: facts.revision,
    source: update.source,
  };
}

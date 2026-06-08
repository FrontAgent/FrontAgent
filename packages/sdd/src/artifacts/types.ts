/**
 * Artifact 类型定义
 * 规格驱动开发的产物存储接口
 */

export type ArtifactType =
  | 'proposal'
  | 'spec'
  | 'design'
  | 'task-list'
  | 'implementation-plan'
  | 'verification-report';

export type ArtifactStatus = 'draft' | 'active' | 'archived';

export interface ArtifactRef {
  id: string;
  type: ArtifactType;
  path: string;
}

export interface ArtifactMeta {
  id: string;
  type: ArtifactType;
  changeId: string;
  version: number;
  status: ArtifactStatus;
  schema?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact extends ArtifactMeta {
  content: string;
}

export interface ArtifactStore {
  save(artifact: Artifact): Promise<void>;
  load(changeId: string, type: ArtifactType): Promise<Artifact | null>;
  loadMeta(changeId: string, type: ArtifactType): Promise<ArtifactMeta | null>;
  list(changeId: string): Promise<ArtifactRef[]>;
  listActive(): Promise<string[]>;
  archive(changeId: string): Promise<void>;
  listArchived(): Promise<string[]>;
}

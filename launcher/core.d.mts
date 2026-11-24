export const RESTART_CODE: number;
export function compareVersions(a: string, b: string): number;
export function cleanVersion(v: string): string;
export function paths(dataDir: string): {
  releases: string;
  state: string;
  backups: string;
  db: string;
};
export function releaseDir(dataDir: string, version: string): string;
export function releaseEntry(dataDir: string, version: string): string;
export type LauncherState = {
  current?: string;
  previous?: string;
  lastRun?: string;
  pending?: { version: string; backup?: string; from?: string; at?: number };
  restore?: { backup: string; version: string };
  trialBackup?: string;
  failed: { version: string; at: number; reason: string }[];
};
export function readState(dataDir: string): LauncherState;
export function writeState(dataDir: string, state: LauncherState): void;
export function chooseTarget(
  state: LauncherState,
  bundledVersion: string,
  isInstalled: (version: string) => boolean,
): { version: string; trial: boolean };
export function backupDatabaseFiles(
  dataDir: string,
  version: string,
  reason: string,
): string | undefined;
export function writeBackupMeta(
  file: string,
  meta: { version: string; reason: string },
): void;
export function restoreDatabase(dataDir: string, backupFile: string): void;

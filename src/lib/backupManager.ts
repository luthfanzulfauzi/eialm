import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

export type BackupEntry = {
  filename: string;
  size: number;
  modifiedAt: string;
};

const BACKUP_FILENAME_PATTERN = /^elitgrid-.*\.dump$/;

const getBackupDir = () => process.env.BACKUP_DIR || path.join(process.cwd(), "backups");

const ensureBackupDir = async () => {
  const backupDir = getBackupDir();
  await fs.mkdir(backupDir, { recursive: true });
  return backupDir;
};

const buildDatabaseUrl = () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const parsed = new URL(raw);
  parsed.search = "";
  return parsed.toString();
};

const runCommand = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });

const formatTimestamp = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
};

export const BackupManager = {
  async listBackups(): Promise<BackupEntry[]> {
    const backupDir = await ensureBackupDir();
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && BACKUP_FILENAME_PATTERN.test(entry.name))
        .map(async (entry) => {
          const filePath = path.join(backupDir, entry.name);
          const stat = await fs.stat(filePath);
          return {
            filename: entry.name,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          };
        })
    );

    return files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  },

  async createBackup() {
    const backupDir = await ensureBackupDir();
    const databaseUrl = buildDatabaseUrl();
    const dbName = new URL(databaseUrl).pathname.replace(/^\//, "") || "elitgrid_db";
    const filename = `elitgrid-${dbName}-${formatTimestamp(new Date())}.dump`;
    const outputPath = path.join(backupDir, filename);

    await runCommand("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      `--dbname=${databaseUrl}`,
      `--file=${outputPath}`,
    ]);

    const stat = await fs.stat(outputPath);
    return {
      filename,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  },

  async restoreBackup(filename: string) {
    if (!BACKUP_FILENAME_PATTERN.test(filename)) {
      throw new Error("Invalid backup filename.");
    }

    const backupDir = await ensureBackupDir();
    const backupPath = path.join(backupDir, filename);
    const databaseUrl = buildDatabaseUrl();

    await fs.access(backupPath);
    await runCommand("pg_restore", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      `--dbname=${databaseUrl}`,
      backupPath,
    ]);

    return {
      filename,
      restoredAt: new Date().toISOString(),
    };
  },

  async getBackupFilePath(filename: string) {
    if (!BACKUP_FILENAME_PATTERN.test(filename)) {
      throw new Error("Invalid backup filename.");
    }

    const backupDir = await ensureBackupDir();
    const backupPath = path.join(backupDir, filename);
    await fs.access(backupPath);
    return backupPath;
  },
};

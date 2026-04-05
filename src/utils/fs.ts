import fs from 'fs-extra';
import path from 'path';

/**
 * Ensure a directory exists, creating it and all parents if needed.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

/**
 * Read a file as UTF-8 string. Returns null if file doesn't exist.
 */
export async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write a file, creating parent directories as needed.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Copy a file, creating parent directories in destination as needed.
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await fs.ensureDir(path.dirname(dest));
  await fs.copy(src, dest);
}

/**
 * Check if a path exists.
 */
export async function exists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

/**
 * List files in a directory matching a glob pattern.
 * Returns full absolute paths.
 */
export async function listFiles(dir: string, pattern: RegExp): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && pattern.test(e.name))
    .map(e => path.join(dir, e.name));
}

/**
 * List subdirectories of a directory.
 * Returns full absolute paths.
 */
export async function listDirs(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => path.join(dir, e.name));
}

/**
 * Read a JSON file. Returns null if file doesn't exist or is invalid.
 */
export async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  const content = await readFile(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Write a JSON file with 2-space indent.
 */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Remove a directory and all its contents.
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.remove(dirPath);
}

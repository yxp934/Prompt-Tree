import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, "../../..");
const packageJsonPath = path.join(packageRoot, "package.json");
const packageLockPath = path.join(packageRoot, "package-lock.json");
const launcherPath = path.join(packageRoot, "bin", "prompt-tree.mjs");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));

function runLauncher(...args: string[]) {
  return spawnSync(process.execPath, [launcherPath, ...args], {
    cwd: packageRoot,
    encoding: "utf8",
  });
}

describe("prompt-tree CLI launcher", () => {
  it("exposes only the prompt-tree executable in package metadata", () => {
    const expectedBin = { "prompt-tree": "bin/prompt-tree.mjs" };

    expect(packageJson.bin).toEqual(expectedBin);
    expect(packageLock.packages[""].bin).toEqual(expectedBin);
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""].version).toBe(packageJson.version);
    expect(fs.existsSync(path.join(packageRoot, "bin", "tree.mjs"))).toBe(false);
  });

  it("keeps an executable Node launcher", () => {
    expect(fs.existsSync(launcherPath)).toBe(true);
    expect(fs.readFileSync(launcherPath, "utf8")).toMatch(/^#!\/usr\/bin\/env node\n/);

    if (process.platform !== "win32") {
      expect(fs.statSync(launcherPath).mode & 0o111).not.toBe(0);
    }
  });

  it("prints help with the new command name", () => {
    const result = runLauncher("--help");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("prompt-tree [--port <port>]");
    expect(result.stdout).not.toMatch(/^\s*tree(?:\s|$)/m);
  });

  it("prints the package version", () => {
    const result = runLauncher("--version");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe("0.7.0");
  });
});

import fs from "node:fs/promises";
import path from "node:path";

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true });
}

async function main() {
  const root = process.cwd();
  const standaloneDir = path.join(root, ".next", "standalone");
  const serverJsPath = path.join(standaloneDir, "server.js");
  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standaloneDir, "public");

  if (!(await pathExists(serverJsPath))) {
    throw new Error(
      "Missing `.next/standalone/server.js`. Ensure `next.config.ts` has `output: \"standalone\"` and run `npm run build`.",
    );
  }

  if (!(await pathExists(staticSrc))) {
    throw new Error("Missing `.next/static`. Run `npm run build` first.");
  }

  await copyDir(staticSrc, staticDest);

  if (await pathExists(publicSrc)) {
    await copyDir(publicSrc, publicDest);
  }

  console.log("Prepared `.next/standalone` (copied static + public).");
}

await main();


#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = "1666";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printHelp() {
  // Avoid printing the real package name here (it may change before publishing).
  console.log(`Usage:
  tree [--port <port>]

Options:
  -p, --port     Port to listen on (default: ${DEFAULT_PORT})
  -h, --help     Show help
  -v, --version  Show version
`);
}

function readPackageVersion(packageRoot) {
  try {
    const pkgJsonPath = path.join(packageRoot, "package.json");
    const raw = fs.readFileSync(pkgJsonPath, "utf8");
    const pkg = JSON.parse(raw);
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let port;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      return { mode: "help" };
    }
    if (arg === "-v" || arg === "--version") {
      return { mode: "version" };
    }
    if (arg === "-p" || arg === "--port") {
      port = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--port=")) {
      port = arg.slice("--port=".length);
      continue;
    }
    return { mode: "error", error: `Unknown argument: ${arg}` };
  }
  return { mode: "start", port };
}

function validatePort(port) {
  if (!port) return { ok: true };
  if (!/^\d+$/.test(port)) return { ok: false, error: `Invalid port: ${port}` };
  const value = Number(port);
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    return { ok: false, error: `Invalid port: ${port}` };
  }
  return { ok: true };
}

function main() {
  const packageRoot = path.resolve(__dirname, "..");
  const parsed = parseArgs(process.argv);

  if (parsed.mode === "help") {
    printHelp();
    return;
  }

  if (parsed.mode === "version") {
    console.log(readPackageVersion(packageRoot));
    return;
  }

  if (parsed.mode === "error") {
    console.error(parsed.error);
    printHelp();
    process.exitCode = 1;
    return;
  }

  const portValidation = validatePort(parsed.port);
  if (!portValidation.ok) {
    console.error(portValidation.error);
    process.exitCode = 1;
    return;
  }

  const standaloneDir = path.join(packageRoot, ".next", "standalone");
  const serverJsPath = path.join(standaloneDir, "server.js");

  if (!fs.existsSync(serverJsPath)) {
    console.error(
      "Missing build output. Run `npm run build` in `ai-chat-client/` before starting, or pack/publish with `npm pack`/`npm publish` (prepack will build).",
    );
    process.exitCode = 1;
    return;
  }

  const env = {
    ...process.env,
    PORT: parsed.port || process.env.PORT || DEFAULT_PORT,
  };

  const portNumber = Number(env.PORT);
  if (
    Number.isInteger(portNumber) &&
    portNumber > 0 &&
    portNumber < 1024 &&
    typeof process.getuid === "function" &&
    process.getuid() !== 0
  ) {
    console.warn(
      `Warning: port ${portNumber} is a privileged port (<1024) on macOS/Linux and may require elevated permissions. Try \`tree --port 1666\` if you see EPERM/EACCES.`,
    );
  }

  const child = spawn(process.execPath, ["server.js"], {
    cwd: standaloneDir,
    env,
    stdio: "inherit",
  });

  const forwardSignal = (signal) => {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  };
  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (typeof code === "number") process.exit(code);
    if (signal) process.kill(process.pid, signal);
    process.exit(0);
  });

  child.on("error", (err) => {
    console.error(err);
    process.exit(1);
  });
}

main();

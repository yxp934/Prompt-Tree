import { spawn } from "node:child_process";

export interface ExecPythonParams {
  code: string;
  timeoutMs: number;
  maxOutputChars: number;
  pythonCommand: string;
}

export interface ExecPythonResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  timedOut: boolean;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function execPython(params: ExecPythonParams): Promise<ExecPythonResult> {
  const code = params.code;
  if (!code.trim()) throw new Error("Python code is empty.");

  const pythonCommand = params.pythonCommand.trim() || "python3";
  const timeoutMs = clampInt(params.timeoutMs, 1000, 120000);
  const maxOutputChars = clampInt(params.maxOutputChars, 1000, 200000);

  const start = Date.now();
  let timedOut = false;
  let truncated = false;
  let killedForTruncation = false;

  const child = spawn(pythonCommand, ["-u", "-c", code], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  const buffers: { stdout: string; stderr: string } = { stdout: "", stderr: "" };

  const tryAppend = (key: "stdout" | "stderr", chunk: string) => {
    if (truncated) return;
    const currentTotal = buffers.stdout.length + buffers.stderr.length;
    const remaining = maxOutputChars - currentTotal;
    if (remaining <= 0) {
      truncated = true;
      if (!killedForTruncation) {
        killedForTruncation = true;
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
      return;
    }

    if (chunk.length <= remaining) {
      buffers[key] += chunk;
      return;
    }

    buffers[key] += chunk.slice(0, remaining);
    truncated = true;
    if (!killedForTruncation) {
      killedForTruncation = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  };

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (data: string) => tryAppend("stdout", data));
  child.stderr?.on("data", (data: string) => tryAppend("stderr", data));

  const killAndMarkTimeout = () => {
    timedOut = true;
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  };

  const timeout = setTimeout(killAndMarkTimeout, timeoutMs);

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(null));
  }).finally(() => clearTimeout(timeout));

  const durationMs = Date.now() - start;
  return {
    stdout: buffers.stdout,
    stderr: buffers.stderr,
    exitCode,
    durationMs,
    truncated,
    timedOut,
  };
}

import { NextResponse } from "next/server";

import { execPython } from "@/lib/server/tools/pythonExec";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : 15000;
  const maxOutputChars =
    typeof body.maxOutputChars === "number" ? body.maxOutputChars : 20000;
  const pythonCommand =
    typeof body.pythonCommand === "string" ? body.pythonCommand : "python3";

  try {
    const result = await execPython({ code, timeoutMs, maxOutputChars, pythonCommand });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Python execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


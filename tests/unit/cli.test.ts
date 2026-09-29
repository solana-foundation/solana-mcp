import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CLI = join(__dirname, "../../cli/src/solana-mcp.mjs");

type RpcReply = Record<string, unknown>;

let server: Server;
let url: string;
let reply: RpcReply;
let received: { name: string; arguments: Record<string, unknown> } | undefined;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      received = JSON.parse(body).params;
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, ...reply })}\n\n`);
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    execFile("node", [CLI, ...args], { env: { ...process.env, SOLANA_MCP_URL: url } }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code as number) : 0, stdout, stderr });
    });
  });
}

function autofixerReply(blocking: boolean): RpcReply {
  const report = {
    issues: [
      {
        severity: blocking ? "high" : "low",
        rule: "r",
        title: "t",
        location: "a.rs:1:1",
        description: "why",
        suggestion: "how",
        fingerprint: "f",
      },
    ],
    suggestions: [],
    framework_detected: "anchor",
    false_positive_hints: {},
    require_another_tool_call_after_fixing: blocking,
  };
  return { result: { content: [{ type: "text", text: JSON.stringify(report) }], structuredContent: report } };
}

describe("solana-mcp cli", () => {
  it("maps search to Solana_Documentation_Search and prints the text", async () => {
    reply = { result: { content: [{ type: "text", text: "match" }] } };
    const out = await run(["search", "derive", "a", "PDA"]);
    expect(received).toEqual({ name: "Solana_Documentation_Search", arguments: { query: "derive a PDA" } });
    expect(out).toMatchObject({ code: 0, stdout: "match\n" });
  });

  it("exits 1 when check reports blocking issues", async () => {
    reply = autofixerReply(true);
    const out = await run(["check", CLI, "--framework", "anchor"]);
    expect(received?.name).toBe("program_autofixer");
    expect(received?.arguments).toMatchObject({ filename: CLI, framework: "anchor" });
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("high\tr\ta.rs:1:1\tt\n  why\n  fix: how");
  });

  it("exits 0 when check reports only advisory issues", async () => {
    reply = autofixerReply(false);
    expect((await run(["check", CLI])).code).toBe(0);
  });

  it("exits 2 on a tool error, a JSON-RPC error, and bad usage", async () => {
    reply = { result: { isError: true, content: [{ type: "text", text: "boom" }] } };
    expect(await run(["sections"])).toMatchObject({ code: 2, stderr: expect.stringContaining("boom") });

    reply = { error: { code: -32602, message: "bad params" } };
    expect(await run(["sections"])).toMatchObject({ code: 2, stderr: expect.stringContaining("bad params") });

    expect((await run(["bogus"])).code).toBe(2);
    expect((await run(["check"])).code).toBe(2);
  });
});

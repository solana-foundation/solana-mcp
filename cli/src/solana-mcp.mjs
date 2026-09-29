#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const ENDPOINT = process.env.SOLANA_MCP_URL ?? "https://mcp.solana.com/mcp";
const TIMEOUT_MS = 60_000;

const USAGE = `Usage: solana-mcp <command> [args] [--json] [--framework anchor|pinocchio]

Commands:
  search <query>        Semantic search over Solana docs
  ask <question>        Ask a how-to or debugging question
  sections              List every doc source and section id
  docs <id...>          Fetch full docs by source id or section id
  check <file.rs|->     Lint Solana program Rust (Anchor, Pinocchio); "-" reads stdin.
                        Pass --framework when it is not detected from imports

Exit codes: 0 ok, 1 check found blocking issues, 2 error`;

class UsageError extends Error {}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function toolCall(command, args, framework) {
  const text = args.join(" ").trim();
  switch (command) {
    case "search":
      if (!text) throw new UsageError("search needs a query");
      return ["Solana_Documentation_Search", { query: text }];
    case "ask":
      if (!text) throw new UsageError("ask needs a question");
      return ["Solana_Expert__Ask_For_Help", { question: text }];
    case "sections":
      return ["list_sections", {}];
    case "docs":
      if (args.length === 0) throw new UsageError("docs needs at least one source or section id");
      return ["get_documentation", { section: args }];
    case "check": {
      if (args.length !== 1) throw new UsageError("check needs exactly one file, or - for stdin");
      const [file] = args;
      const code = file === "-" ? await readStdin() : await readFile(file, "utf8");
      return [
        "program_autofixer",
        { code, ...(file === "-" ? {} : { filename: file }), ...(framework ? { framework } : {}) },
      ];
    }
    default:
      throw new UsageError(`unknown command: ${command}`);
  }
}

function parseRpcResponse(contentType, body) {
  if (!contentType.includes("text/event-stream")) return JSON.parse(body);
  const messages = body
    .split("\n")
    .filter(line => line.startsWith("data: "))
    .map(line => JSON.parse(line.slice("data: ".length)));
  const message = messages.find(m => m.id === 1);
  if (!message) throw new Error("no JSON-RPC response in event stream");
  return message;
}

async function callTool(name, args) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${ENDPOINT}: ${body.slice(0, 500)}`);
  const message = parseRpcResponse(res.headers.get("content-type") ?? "", body);
  if (message.error) throw new Error(`server error: ${message.error.message}`);
  const result = message.result;
  if (result.isError) throw new Error(result.content?.map(c => c.text).join("\n") || "tool returned an error");
  return result;
}

function formatCheck(report) {
  const lines = [
    ...report.issues.flatMap(i => [
      `${i.severity}\t${i.rule}\t${i.location}\t${i.title}${i.dismissed ? " (dismissed)" : ""}`,
      ...(i.description ? [`  ${i.description}`] : []),
      ...(i.suggestion ? [`  fix: ${i.suggestion}`] : []),
    ]),
    ...report.suggestions.map(s => `suggestion\t${s}`),
  ];
  return lines.length === 0 ? "No issues found." : lines.join("\n");
}

async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { json: { type: "boolean" }, framework: { type: "string" }, help: { type: "boolean", short: "h" } },
    });
  } catch (err) {
    throw new UsageError(err.message);
  }
  const { json, framework, help } = parsed.values;
  const [command, ...args] = parsed.positionals;
  if (help || command === "help") {
    console.log(USAGE);
    return 0;
  }
  if (!command) throw new UsageError("missing command");

  const [name, toolArgs] = await toolCall(command, args, framework);
  const result = await callTool(name, toolArgs);

  if (command === "check") {
    const report = result.structuredContent ?? JSON.parse(result.content[0].text);
    console.log(json ? JSON.stringify(report, null, 2) : formatCheck(report));
    return report.require_another_tool_call_after_fixing ? 1 : 0;
  }

  console.log(json ? JSON.stringify(result, null, 2) : result.content.map(c => c.text).join("\n"));
  return 0;
}

main(process.argv.slice(2)).then(
  code => {
    process.exitCode = code;
  },
  err => {
    console.error(`solana-mcp: ${err.message}`);
    if (err instanceof UsageError) console.error(`\n${USAGE}`);
    process.exitCode = 2;
  },
);

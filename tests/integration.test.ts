import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSolanaTools } from "../lib/tools/generalSolanaTools";
import { createProgramAutofixerTool } from "../lib/tools/programAutofixer/index.js";

const { createMcpHandlerMock } = vi.hoisted(() => ({
  createMcpHandlerMock: vi.fn(),
}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: createMcpHandlerMock,
}));

import { createMcp } from "../lib";

type InitializeServer = (server: { registerTool: (...args: unknown[]) => unknown }) => Promise<void> | void;

const allTools = [...createSolanaTools(), createProgramAutofixerTool()];

describe("createMcp", () => {
  beforeEach(() => {
    createMcpHandlerMock.mockReset();
    createMcpHandlerMock.mockReturnValue(vi.fn());
  });

  it("configures the MCP adapter with the expected options", () => {
    const requestHandler = vi.fn();
    createMcpHandlerMock.mockReturnValue(requestHandler);

    const handler = createMcp();
    expect(handler).toBe(requestHandler);

    expect(createMcpHandlerMock).toHaveBeenCalledTimes(1);
    const [initializeServer, options] = createMcpHandlerMock.mock.calls[0] as [
      InitializeServer,
      {
        serverInfo: { name: string; version: string };
        instructions?: string;
        verboseLogs: boolean;
      },
    ];

    expect(typeof initializeServer).toBe("function");
    expect(options.serverInfo).toEqual({ name: "solana-mcp", version: "2.0.0" });
    expect(options.instructions).toContain("list_sections");
    expect(options.instructions).toContain("get_documentation");
    expect(options.instructions).toContain("Solana_Documentation_Search");
    expect(options.verboseLogs).toBe(true);
  });

  it("registers every tool exactly once", async () => {
    createMcp();
    const [initializeServer] = createMcpHandlerMock.mock.calls[0] as [InitializeServer];

    const registerToolMock = vi.fn();
    await initializeServer({ registerTool: registerToolMock });

    expect(registerToolMock).toHaveBeenCalledTimes(allTools.length);

    const registerToolCalls = registerToolMock.mock.calls as Array<
      [
        string,
        {
          description: string;
          inputSchema: unknown;
          outputSchema?: unknown;
          annotations?: Record<string, unknown>;
        },
        unknown,
      ]
    >;
    for (const tool of allTools) {
      const matchingCall = registerToolCalls.find(([name]) => name === tool.title);
      expect(matchingCall).toBeDefined();
      if (!matchingCall) {
        continue;
      }

      const [, options, handler] = matchingCall;
      expect(options.description).toBe(tool.description ?? "");
      expect(options.inputSchema).toBeDefined();
      if (tool.outputSchema) {
        expect(options.outputSchema).toBeDefined();
      }
      if (tool.annotations) {
        expect(options.annotations).toEqual(tool.annotations);
      }
      expect(typeof handler).toBe("function");
    }
  });
});

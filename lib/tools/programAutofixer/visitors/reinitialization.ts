import type { Node } from "web-tree-sitter";
import type { Visitor } from "../types.js";
import { formatLocation, report } from "../types.js";
import { getCallName, walk } from "../walk.js";
import {
  bodyContainsRejectingCheckFor,
  findEnclosingFunctionBody,
  getCallArgs,
  getFieldInitValue,
  getMethodReceiverRoot,
  isCreateAccountStruct,
  lamportsReceiverRoot,
  rootIdentifierOf,
} from "./_helpers.js";

const INIT_GUARD_MARKERS = ["data_len", "data_is_empty", "discriminator", "is_initialized", "lamports"];
const VALIDATION_FN_RE = /check|ensure|verify|assert/i;

function isZeroLiteral(node: Node | null): boolean {
  return node?.type === "integer_literal" && node.text === "0";
}

function fieldNameOf(node: Node): string | null {
  if (node.type !== "field_expression") return null;
  return node.childForFieldName("field")?.text ?? null;
}

function comparisonChecksExistingTarget(node: Node, target: string): boolean {
  if (node.type !== "binary_expression") return false;
  const op = node.childForFieldName("operator")?.text;
  if (op !== ">" && op !== "==" && op !== "!=") return false;
  const left = node.childForFieldName("left");
  const right = node.childForFieldName("right");
  if (!left || !right) return false;
  const leftRoot = lamportsReceiverRoot(left);
  const rightRoot = lamportsReceiverRoot(right);
  if (leftRoot === target && isZeroLiteral(right)) return true;
  return rightRoot === target && isZeroLiteral(left);
}

function scopeChecksExistingLamports(scope: Node, beforeIndex: number, target: string): boolean {
  let found = false;
  walk(scope, n => {
    if (found) return "skip";
    if (n.startIndex >= beforeIndex) return "skip";
    if (comparisonChecksExistingTarget(n, target)) {
      found = true;
      return "skip";
    }
  });
  return found;
}

function precedingValidationCall(scope: Node, beforeIndex: number, target: string): boolean {
  let found = false;
  walk(scope, n => {
    if (found) return "skip";
    if (n.startIndex >= beforeIndex) return "skip";
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    const name = fn ? getCallName(fn) : null;
    if (!name || !VALIDATION_FN_RE.test(name)) return;
    if (getCallArgs(n).some(a => rootIdentifierOf(a) === target) || getMethodReceiverRoot(n) === target) {
      found = true;
    }
  });
  return found;
}

export const reinitialization: Visitor = {
  name: "reinitialization",
  severity: "medium",
  appliesTo: ["pinocchio"],
  falsePositiveWhen: [
    "init guard in helper defined elsewhere (ensure_uninitialized(pda))",
    "guard checks signal outside data_len/data_is_empty/discriminator/is_initialized/lamports (owner == system_program)",
    "create target unresolvable to an account",
    "program intentionally relies on runtime AccountAlreadyInitialized",
  ],
  enter: {
    struct_expression(node, ctx) {
      if (!isCreateAccountStruct(node)) return;
      const scope = findEnclosingFunctionBody(node);
      if (!scope) return;
      const to = getFieldInitValue(node, "to");
      const target = to ? (rootIdentifierOf(to) ?? fieldNameOf(to)) : null;
      if (target) {
        if (scopeChecksExistingLamports(scope, node.startIndex, target)) return;
        if (bodyContainsRejectingCheckFor(scope, target, INIT_GUARD_MARKERS)) return;
        if (
          ctx.tryFromBodies.some(
            tf =>
              bodyContainsRejectingCheckFor(tf.body, target, INIT_GUARD_MARKERS) ||
              tf.destructured.some(name => bodyContainsRejectingCheckFor(tf.body, name, INIT_GUARD_MARKERS)),
          )
        ) {
          return;
        }
        if (precedingValidationCall(scope, node.startIndex, target)) return;
      }
      report(ctx, reinitialization, {
        title: `CreateAccount used without checking existing lamports`,
        location: formatLocation(ctx.filename, node),
        description: `\`CreateAccount\` in this function is invoked without a preceding check that the target account doesn't already exist (e.g. \`pda_account.lamports() > 0\`). An attacker can pre-fund the PDA to make creation fail, or worse, re-initialise an already-initialised account if the program doesn't guard against it.`,
        suggestion: `Before invoking CreateAccount, guard with \`if pda_account.lamports() > 0 { return Err(ProgramError::AccountAlreadyInitialized); }\` (or use the idempotent allocate+assign pattern).`,
      });
    },
  },
};

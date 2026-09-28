import type { Visitor } from "../types.js";
import { formatLocation, report } from "../types.js";
import { getFieldInitValue, isCreateAccountStruct } from "./_helpers.js";

export const rentExempt: Visitor = {
  name: "rent-exempt",
  severity: "medium",
  appliesTo: ["pinocchio"],
  falsePositiveWhen: [
    "hardcoded literal intentionally correct for a fixed-size account or allocate-only path",
    "value provably equals the rent minimum for the account size",
  ],
  enter: {
    struct_expression(node, ctx) {
      if (!isCreateAccountStruct(node)) return;
      const lamportsExpr = getFieldInitValue(node, "lamports");
      if (!lamportsExpr) return;
      // Acceptable: identifier (assumed rent-derived), call_expression, field_expression.
      // Reject: integer_literal (hardcoded).
      if (lamportsExpr.type !== "integer_literal") return;
      report(ctx, rentExempt, {
        title: `CreateAccount uses a hardcoded lamports value`,
        location: formatLocation(ctx.filename, lamportsExpr),
        description: `\`CreateAccount { lamports: ${lamportsExpr.text}, .. }\` hardcodes the lamports amount instead of computing rent-exempt minimum. If the rent rate changes or the account size is larger than expected, the new account will be subject to rent collection.`,
        suggestion: `Use the real Pinocchio rent sysvar: import \`pinocchio::sysvars::{rent::Rent, Sysvar}\`, compute \`let lamports = Rent::get()?.try_minimum_balance(space as usize)?;\`, and pass that \`lamports\` value to \`CreateAccount\`. Do not create a local \`Rent\` shim or hardcode a fallback value.`,
      });
    },
  },
};

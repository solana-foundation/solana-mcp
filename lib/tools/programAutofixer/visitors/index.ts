import type { Visitor } from "../types.js";
import { missingSigner } from "./missing-signer.js";
import { missingOwner } from "./missing-owner.js";
import { discriminatorCheck } from "./discriminator-check.js";
import { programIdVerification } from "./program-id-verification.js";
import { uncheckedArithmetic } from "./unchecked-arithmetic.js";
import { sysvarSpoofing } from "./sysvar-spoofing.js";
import { arbitraryCpi } from "./arbitrary-cpi.js";
import { pdaValidation } from "./pda-validation.js";
import { unsafeUnwrap } from "./unsafe-unwrap.js";
import { uncheckedDeserialization } from "./unchecked-deserialization.js";
import { dataSizeValidation } from "./data-size-validation.js";
import { typeCosplay } from "./type-cosplay.js";
import { accountClosure } from "./account-closure.js";
import { reinitialization } from "./reinitialization.js";
import { existingLamports } from "./existing-lamports.js";
import { rentExempt } from "./rent-exempt.js";
import { authorityEscalation } from "./authority-escalation.js";
import { token2022Extensions } from "./token-2022-extensions.js";
import { instructionDataBounds } from "./instruction-data-bounds.js";
import { pdaSeedCollision } from "./pda-seed-collision.js";
import { accountRelationship } from "./account-relationship.js";
import { accountBorrow } from "./account-borrow.js";
import { anchorSeedsWithoutBump } from "./anchor-seeds-without-bump.js";
import { anchorInitWithoutSpace } from "./anchor-init-without-space.js";
import { anchorInitWithoutPayer } from "./anchor-init-without-payer.js";
import { anchorReallocIncomplete } from "./anchor-realloc-incomplete.js";
import { anchorUncheckedAccount } from "./anchor-unchecked-account.js";
import { anchorManualSignerCheck } from "./anchor-manual-signer-check.js";
import { anchorMissingMut } from "./anchor-missing-mut.js";
import { anchorCpiContextUnverified } from "./anchor-cpi-context-unverified.js";
import { anchorCloseWithoutReceiver } from "./anchor-close-without-receiver.js";

/**
 * Visitor registry. Numbered checks map to
 * pinocchio-security-analyzer/skills/pinocchio-security-patterns/references/vulnerability-catalog.md.
 *
 * Account validation
 *   program-id-verification     → Check 1
 *   missing-owner               → Check 2
 *   missing-signer              → Check 4
 *   sysvar-spoofing             → Check 7
 *
 * PDA security
 *   pda-validation              → Check 8
 *   pda-seed-collision          → Check 9
 *
 * Data integrity
 *   discriminator-check         → Check 11
 *   data-size-validation        → Check 12
 *   type-cosplay                → Check 13
 *   unchecked-deserialization   → Check 14
 *
 * Account lifecycle
 *   reinitialization            → Check 15
 *   existing-lamports           → Check 16
 *   rent-exempt                 → Check 17
 *   account-closure             → Check 23
 *
 * CPI security
 *   arbitrary-cpi               → Check 18
 *   authority-escalation        → Check 19
 *
 * Code quality
 *   unchecked-arithmetic        → Check 20
 *   token-2022-extensions       → Check 22
 *   instruction-data-bounds     → Check 24
 *   unsafe-unwrap               → Check 25
 *   account-relationship        → Check 26
 *   account-borrow              → Check 27
 */
export const allVisitors: readonly Visitor[] = [
  missingSigner,
  missingOwner,
  discriminatorCheck,
  programIdVerification,
  sysvarSpoofing,
  arbitraryCpi,
  pdaValidation,
  uncheckedArithmetic,
  unsafeUnwrap,
  uncheckedDeserialization,
  dataSizeValidation,
  typeCosplay,
  accountClosure,
  reinitialization,
  existingLamports,
  rentExempt,
  authorityEscalation,
  token2022Extensions,
  instructionDataBounds,
  pdaSeedCollision,
  accountRelationship,
  accountBorrow,
  anchorSeedsWithoutBump,
  anchorInitWithoutSpace,
  anchorInitWithoutPayer,
  anchorReallocIncomplete,
  anchorUncheckedAccount,
  anchorManualSignerCheck,
  anchorMissingMut,
  anchorCpiContextUnverified,
  anchorCloseWithoutReceiver,
];

import { isJunkCity } from "./cities";

export interface RiskInput {
  isNewPhone: boolean;
  cityVerified: boolean;
  rawCity: string;
  subtotal: number; // paisa
  maxSubtotal: number; // hard cap (paisa) used for the legacy high-value tag
  highValueCap: number; // paisa; new phones above this need advance
  refusals: number; // from PhoneBlock
  /** Same variant ordered by anyone in the last 24h (max over lines). */
  variantOrders24h: number;
}

export interface RiskResult {
  tags: string[];
  score: number;
  needsConfirmation: boolean;
  advanceRequired: boolean;
}

export const VELOCITY_LIMIT = 3;

export function assessRisk(i: RiskInput): RiskResult {
  const tags: string[] = [];
  let score = 0;

  if (i.isNewPhone) tags.push("risk:new-phone");
  if (!i.cityVerified) {
    tags.push("risk:city-unverified");
    if (isJunkCity(i.rawCity)) {
      tags.push("risk:junk-city");
      score += 2;
    }
  }
  const highValue = i.subtotal > i.highValueCap;
  if (highValue) {
    tags.push("risk:high-value");
    score += 2;
  }
  if (i.subtotal > i.maxSubtotal) tags.push("risk:over-max-subtotal");
  if (i.refusals > 0) {
    tags.push("risk:repeat-refusals");
    score += 2 * i.refusals;
  }
  if (i.variantOrders24h >= VELOCITY_LIMIT) {
    tags.push("risk:velocity");
    score += 1;
  }

  // Returning phones are trusted unless they have refusals on record.
  const flagged = i.isNewPhone ? score > 0 : i.refusals > 0;
  const advanceRequired = i.isNewPhone && highValue;
  if (flagged || advanceRequired) tags.push("needs-confirmation");
  if (advanceRequired) tags.push("advance-required");

  return { tags, score, needsConfirmation: flagged || advanceRequired, advanceRequired };
}

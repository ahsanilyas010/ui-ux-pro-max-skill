import type { PrismaClient } from "@prisma/client";

export interface RateRule {
  key: string;
  limit: number;
  windowMs: number;
}

export const IP_RULE = (ip: string): RateRule => ({ key: `ip:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 });
export const PHONE_RULE = (phone: string): RateRule => ({ key: `phone:${phone}`, limit: 3, windowMs: 60 * 60 * 1000 });

/**
 * Sliding window using RateHit rows. Returns null when allowed (and records a hit),
 * otherwise the number of seconds to wait.
 */
export async function checkRate(db: PrismaClient, rule: RateRule, now = Date.now()): Promise<number | null> {
  const since = new Date(now - rule.windowMs);
  const hits = await db.rateHit.findMany({
    where: { key: rule.key, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (hits.length >= rule.limit) {
    const oldest = hits[0].createdAt.getTime();
    return Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000));
  }
  await db.rateHit.create({ data: { key: rule.key } });
  return null;
}

export async function cleanupRateHits(db: PrismaClient, olderThanMs = 2 * 60 * 60 * 1000) {
  await db.rateHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - olderThanMs) } } });
}

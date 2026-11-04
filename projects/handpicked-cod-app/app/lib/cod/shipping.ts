export interface ShippingConfig {
  /** paisa */
  freeThreshold: number;
  /** paisa */
  flatRate: number;
}

export function computeShipping(subtotal: number, cfg: ShippingConfig): number {
  if (subtotal <= 0) return 0;
  return subtotal >= cfg.freeThreshold ? 0 : cfg.flatRate;
}

export function computeTotals(subtotal: number, cfg: ShippingConfig) {
  const shipping = computeShipping(subtotal, cfg);
  return { subtotal, shipping, total: subtotal + shipping };
}

/** Shopify money strings are decimal PKR; convert paisa -> "1234.50". */
export function paisaToDecimal(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

/** Parse Shopify decimal PKR string to paisa without float drift. */
export function decimalToPaisa(value: string | number): number {
  return Math.round(Number(value) * 100);
}

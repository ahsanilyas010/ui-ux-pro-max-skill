import { decimalToPaisa } from "./shipping";

export interface AdminLike {
  graphql: (query: string, opts?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

export interface VariantInfo {
  id: string; // numeric
  gid: string;
  title: string;
  price: number; // paisa
  availableForSale: boolean;
  inventoryQuantity: number | null;
  inventoryPolicy: "DENY" | "CONTINUE";
  product: {
    id: string;
    title: string;
    vendor: string;
    handle: string;
    status: string;
    published: boolean; // onlineStoreUrl != null
    imageUrl: string | null;
  };
}

export type VariantProblem = { variantId: string; reason: "missing" | "inactive" | "unpublished" | "sold_out" | "insufficient_stock"; available?: number };

const QUERY = `#graphql
  query CodVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        price
        availableForSale
        inventoryQuantity
        inventoryPolicy
        product {
          id
          title
          vendor
          handle
          status
          onlineStoreUrl
          featuredMedia { preview { image { url } } }
        }
      }
    }
  }`;

export const toGid = (id: string) => `gid://shopify/ProductVariant/${id}`;

export async function fetchVariants(admin: AdminLike, ids: string[]): Promise<Map<string, VariantInfo>> {
  const res = await admin.graphql(QUERY, { variables: { ids: ids.map(toGid) } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await res.json()) as { data?: { nodes: Array<any> }; errors?: unknown };
  if (!body.data) throw new Error("variant lookup failed");
  const out = new Map<string, VariantInfo>();
  for (const n of body.data.nodes) {
    if (!n?.id) continue;
    const id = String(n.id).split("/").pop()!;
    out.set(id, {
      id,
      gid: n.id,
      title: n.title,
      price: decimalToPaisa(n.price),
      availableForSale: !!n.availableForSale,
      inventoryQuantity: n.inventoryQuantity ?? null,
      inventoryPolicy: n.inventoryPolicy,
      product: {
        id: n.product.id,
        title: n.product.title,
        vendor: n.product.vendor,
        handle: n.product.handle,
        status: n.product.status,
        published: n.product.onlineStoreUrl != null,
        imageUrl: n.product.featuredMedia?.preview?.image?.url ?? null,
      },
    });
  }
  return out;
}

/** Pure validation: product ACTIVE and published, sellable, and quantity <= stock when policy is DENY. */
export function validateLines(
  lines: Array<{ variantId: string; quantity: number }>,
  variants: Map<string, VariantInfo>,
): VariantProblem[] {
  // Combine quantities per variant so split lines cannot bypass the stock check.
  const wanted = new Map<string, number>();
  for (const l of lines) wanted.set(l.variantId, (wanted.get(l.variantId) ?? 0) + l.quantity);

  const problems: VariantProblem[] = [];
  for (const [variantId, qty] of wanted) {
    const v = variants.get(variantId);
    if (!v) problems.push({ variantId, reason: "missing" });
    else if (v.product.status !== "ACTIVE") problems.push({ variantId, reason: "inactive" });
    else if (!v.product.published) problems.push({ variantId, reason: "unpublished" });
    else if (!v.availableForSale) problems.push({ variantId, reason: "sold_out", available: 0 });
    else if (v.inventoryPolicy === "DENY" && v.inventoryQuantity !== null && qty > v.inventoryQuantity) {
      problems.push({ variantId, reason: "insufficient_stock", available: Math.max(0, v.inventoryQuantity) });
    }
  }
  return problems;
}

export function subtotalOf(lines: Array<{ variantId: string; quantity: number }>, variants: Map<string, VariantInfo>): number {
  return lines.reduce((sum, l) => sum + (variants.get(l.variantId)?.price ?? 0) * l.quantity, 0);
}

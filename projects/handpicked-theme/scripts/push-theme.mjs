#!/usr/bin/env node
/**
 * push-theme.mjs — upload this theme to a Shopify store as files on an existing (UNPUBLISHED) theme
 * using the Admin GraphQL themeFilesUpsert mutation (max 50 files per request).
 *
 * Usage:
 *   SHOPIFY_STORE=hand-picked-online.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node scripts/push-theme.mjs --theme gid://shopify/OnlineStoreTheme/123 [--prune] [--dry-run]
 *
 * --prune deletes files that exist on the remote theme but not locally (use after duplicating Dawn).
 * Never publishes. Requires an Admin API access token with write_themes.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(name);
const themeId = opt('--theme');
const store = process.env.SHOPIFY_STORE;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';
if (!themeId || !store || !token) {
  console.error('Need --theme <gid>, SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN');
  process.exit(1);
}

const THEME_DIRS = ['layout', 'config', 'locales', 'templates', 'sections', 'snippets', 'assets'];
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.otf', '.ico', '.mp4']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = THEME_DIRS.flatMap((d) => { try { return walk(join(root, d)); } catch { return []; } })
  .map((p) => relative(root, p).split('\\').join('/'))
  .filter((f) => !f.includes('/_fragments/') && !f.endsWith('.DS_Store'));

async function gql(query, variables) {
  const res = await fetch(`https://${store}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function toInput(filename) {
  const abs = join(root, filename);
  const ext = extname(filename).toLowerCase();
  if (BINARY.has(ext)) return { filename, body: { type: 'BASE64', value: readFileSync(abs).toString('base64') } };
  return { filename, body: { type: 'TEXT', value: readFileSync(abs, 'utf8') } };
}

const UPSERT = `mutation($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename }
    job { id done }
    userErrors { filename code message }
  }
}`;
const LIST = `query($id: ID!, $after: String) { theme(id: $id) { files(first: 250, after: $after) { nodes { filename } pageInfo { hasNextPage endCursor } } } }`;
const DELETE = `mutation($themeId: ID!, $files: [String!]!) { themeFilesDelete(themeId: $themeId, files: $files) { deletedThemeFiles { filename } userErrors { filename code message } } }`;
const JOB = `query($id: ID!) { job(id: $id) { id done } }`;

async function waitJob(id) {
  for (let i = 0; i < 60; i++) {
    const { job } = await gql(JOB, { id });
    if (!job || job.done) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

(async () => {
  console.log(`Theme ${themeId} on ${store}: ${files.length} local files`);
  // Batch by count (≤50) and by payload size (~400 KB) to stay under request limits.
  const batches = [];
  let cur = [], size = 0;
  for (const f of files) {
    const input = toInput(f);
    const len = input.body.value.length;
    if (cur.length >= 50 || size + len > 400_000) { batches.push(cur); cur = []; size = 0; }
    cur.push(input); size += len;
  }
  if (cur.length) batches.push(cur);
  console.log(`${batches.length} batches`);
  if (flag('--dry-run')) { batches.forEach((b, i) => console.log(`batch ${i + 1}:`, b.map((x) => x.filename).join(', '))); return; }

  for (const [i, batch] of batches.entries()) {
    const data = await gql(UPSERT, { themeId, files: batch });
    const r = data.themeFilesUpsert;
    if (r.userErrors?.length) { console.error('userErrors', r.userErrors); process.exitCode = 1; }
    if (r.job?.id && !r.job.done) await waitJob(r.job.id);
    console.log(`batch ${i + 1}/${batches.length} ok (${batch.length} files)`);
  }

  if (flag('--prune')) {
    const remote = [];
    let after = null;
    do {
      const { theme } = await gql(LIST, { id: themeId, after });
      remote.push(...theme.files.nodes.map((n) => n.filename));
      after = theme.files.pageInfo.hasNextPage ? theme.files.pageInfo.endCursor : null;
    } while (after);
    const local = new Set(files);
    const stale = remote.filter((f) => !local.has(f));
    console.log(`pruning ${stale.length} remote-only files`);
    for (let i = 0; i < stale.length; i += 50) {
      const data = await gql(DELETE, { themeId, files: stale.slice(i, i + 50) });
      if (data.themeFilesDelete.userErrors?.length) console.error(data.themeFilesDelete.userErrors);
    }
  }
  console.log('done — preview at https://handpicked.pk/?preview_theme_id=' + themeId.split('/').pop());
})().catch((e) => { console.error(e); process.exit(1); });

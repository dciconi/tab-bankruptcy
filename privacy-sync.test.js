// Verify PRIVACY.md (root, ships in zip) and docs/privacy.md (Pages-served)
// have identical substantive content. Both files have small housekeeping
// prologues — Jekyll frontmatter + HTML sync comment in docs/privacy.md;
// a markdown blockquote noting the canonical URL in PRIVACY.md — that we
// strip before comparing.

const assert = require('assert');
const fs = require('fs');

function bodyOf(text) {
  let s = text.replace(/^﻿/, ''); // strip BOM if any
  // Strip Jekyll frontmatter at the very top (docs/privacy.md only).
  s = s.replace(/^---\n[\s\S]*?\n---\n*/, '');
  // Find the H1 — substantive policy starts there in both files.
  const h1 = s.indexOf('# Tab Bankruptcy — Privacy Policy');
  if (h1 === -1) throw new Error('could not find H1 anchor');
  s = s.slice(h1);
  // Strip the canonical-version note in PRIVACY.md: a contiguous "> ..."
  // block immediately after the "Last updated" line and BEFORE the first
  // "## " section heading. docs/privacy.md doesn't have this block, so the
  // regex no-ops there.
  s = s.replace(/(\*\*Last updated:[^\n]*\n+)(>[^\n]*\n)+\n+(?=##)/, '$1');
  return s.trim();
}

const root = fs.readFileSync('PRIVACY.md', 'utf8');
const pages = fs.readFileSync('docs/privacy.md', 'utf8');

const rootBody = bodyOf(root);
const pagesBody = bodyOf(pages);

if (rootBody !== pagesBody) {
  const rootLines = rootBody.split('\n');
  const pagesLines = pagesBody.split('\n');
  let firstDiff = -1;
  for (let i = 0; i < Math.max(rootLines.length, pagesLines.length); i++) {
    if (rootLines[i] !== pagesLines[i]) { firstDiff = i; break; }
  }
  console.error('❌ PRIVACY.md and docs/privacy.md have diverged.');
  console.error(`First differing line: ${firstDiff + 1}`);
  console.error(`  PRIVACY.md:        ${JSON.stringify(rootLines[firstDiff])}`);
  console.error(`  docs/privacy.md:   ${JSON.stringify(pagesLines[firstDiff])}`);
  console.error('');
  console.error('Edit both files together. The privacy policy ships in the extension');
  console.error('zip via PRIVACY.md and is published to GitHub Pages via docs/privacy.md.');
  process.exit(1);
}

console.log('✅ PRIVACY.md and docs/privacy.md are in sync');

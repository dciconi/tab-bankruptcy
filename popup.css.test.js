/**
 * popup.css.test.js — CSS validation for Tab Bankruptcy
 * Checks that popup.css contains required dark theme vars, selectors, and animations.
 */

const fs = require('fs');
const path = require('path');

const CSS_FILE = path.join(__dirname, 'popup.css');
const css = fs.readFileSync(CSS_FILE, 'utf8');

const required = [
  /:root\s*\{[\s\S]*?--bg:/,
  /:root\s*\{[\s\S]*?--card:/,
  /:root\s*\{[\s\S]*?--accent:/,
  /:root\s*\{[\s\S]*?--danger:/,
  /body\s*\{[\s\S]*?min-width:\s*360px/,
  /#header[\s\S]*?display:\s*flex/,
  /#mascot[\s\S]*?animation:/,
  /#btn-declare[\s\S]*?background:/,
  /\.cluster-card[\s\S]*?transform:/,
  /\.btn-keep[\s\S]*?background:/,
  /\.btn-save[\s\S]*?background:/,
  /\.btn-nuke[\s\S]*?background:/,
  /#loading-view[\s\S]*?\.spinner/,
  /#completion-view[\s\S]*?#confetti-container/,
  /@keyframes\s+spin/,
  /@keyframes\s+slide-up/,
  /@media\s*\(\s*prefers-reduced-motion[\s\S]*?\.confetti-container/,
  /@media\s*\(\s*prefers-reduced-motion[\s\S]*?\.nuke-explode/,
  /@media\s*\(\s*prefers-reduced-motion[\s\S]*?\.spinner/,
  /@media\s*\(\s*prefers-reduced-motion[\s\S]*?\.pulse/,
  /#view-error\.active[\s\S]*?display:\s*flex/,
  /\.error-content[\s\S]*?background:\s*linear-gradient[\s\S]*?border:\s*1px solid/,
  /\.error-actions[\s\S]*?grid-template-columns/,
  /#view-error\s+\.btn-primary[\s\S]*?background:\s*linear-gradient/,
  /body\.light-mode\s*\{[\s\S]*?--text:\s*#111827/,
  /body\.light-mode\s+#view-idle\s+\.tab-count\s*\{[\s\S]*?background:\s*linear-gradient/,
  /body\.light-mode\s+#view-idle\s+\.tab-count\s+#idle-tab-count\s*\{[\s\S]*?color:\s*#0f172a/,
  /body\.light-mode\s+\.action-bar\s+\.btn\s*\{[\s\S]*?border:\s*1px solid/,
  /body\.light-mode\s+\.cluster-card\.expanded\s*\{[\s\S]*?height:\s*auto/,
  /#view-triage,\s*#triage-view\s*\{[\s\S]*?min-height:\s*100vh/,
  /#view-triage\.active,\s*#view-triage\.view\.active,\s*#triage-view\.active\s*\{[\s\S]*?display:\s*flex/,
  /#clusters-container\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0/,
  /\.triage-toolbar\s*\{[\s\S]*?position:\s*sticky/,
  /\.triage-toolbar\s+#cluster-search:focus\s*\{[\s\S]*?border-color:\s*var\(--accent\)/,
  /\.mini-last-active\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums/,
  /\.cluster-card\.no-match[\s\S]*?display:\s*none/,
];

let passed = 0;
let failed = 0;

required.forEach((regex, i) => {
  if (regex.test(css)) {
    passed++;
    console.log(`✅ Rule ${i + 1} passed: ${regex}`);
  } else {
    failed++;
    console.log(`❌ Rule ${i + 1} failed: ${regex}`);
  }
});

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

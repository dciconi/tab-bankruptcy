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

// manifest.test.js — validates manifest.json structure for MV3
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

const required = ['manifest_version', 'name', 'version', 'permissions', 'host_permissions', 'action', 'background', 'icons', 'content_security_policy'];
const errors = [];

required.forEach(key => {
  if (!(key in manifest)) errors.push(`Missing ${key}`);
});

if (manifest.manifest_version !== 3) errors.push('manifest_version must be 3');
if (!manifest.permissions.includes('tabs')) errors.push('permissions must include "tabs"');
if (!manifest.permissions.includes('storage')) errors.push('permissions must include "storage"');
if (!manifest.permissions.includes('tabGroups')) errors.push('permissions must include "tabGroups"');
// host_permissions includes all four BYOK providers + Puter
const expectedHosts = [
  'https://api.x.ai/*',
  'https://api.openai.com/*',
  'https://api.anthropic.com/*',
  'https://generativelanguage.googleapis.com/*',
  'https://api.puter.com/*',
  'https://*.puter.com/*'
];
for (const h of expectedHosts) {
  if (!manifest.host_permissions || !manifest.host_permissions.includes(h)) {
    errors.push(`host_permissions missing ${h}`);
  }
}

// Legacy proxy host is gone
if (manifest.host_permissions?.some(h => h.includes('autoqa.teachx.ai'))) {
  errors.push('host_permissions still includes legacy autoqa.teachx.ai');
}

// CSP connect-src lists all expected hosts and not the legacy one
const csp = manifest.content_security_policy?.extension_pages || '';
if (csp.includes('autoqa.teachx.ai')) {
  errors.push('CSP still references legacy autoqa.teachx.ai');
}
for (const host of ['api.x.ai', 'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'api.puter.com']) {
  if (!csp.includes(host)) {
    errors.push(`CSP connect-src missing ${host}`);
  }
}
// Puter SDK uses Socket.IO over WebSocket for real-time events; CSP must
// allow wss:// to api.puter.com or the page logs noisy violation errors.
for (const wssHost of ['wss://api.puter.com', 'wss://*.puter.com']) {
  if (!csp.includes(wssHost)) {
    errors.push(`CSP connect-src missing ${wssHost}`);
  }
}
// default_popup optional — onClicked opens full tab view
if (!manifest.background?.service_worker) errors.push('background.service_worker required');
if (!manifest.icons?.['48'] || !manifest.icons?.['128']) errors.push('icons 48 and 128 required');
if (!manifest.content_security_policy?.extension_pages?.includes('connect-src')) errors.push('CSP connect-src required');
if (!manifest.content_security_policy?.extension_pages?.includes('script-src')) errors.push('CSP script-src required');

if (errors.length) {
  console.error('❌ Manifest validation failed:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('✅ manifest.json structure valid (MV3, permissions, CSP, icons)');

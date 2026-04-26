const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('options.html', 'utf8');
const css = fs.readFileSync('options.css', 'utf8');

assert.match(
  html,
  /<label class="select-row">\s*<div class="select-label">\s*<span class="select-title">Default model<\/span>\s*<span class="select-desc">Choose the Puter model used for tab clustering<\/span>\s*<\/div>\s*<select id="puter-model"><\/select>\s*<\/label>/,
  'Puter model select should use the same labeled structure as the theme select'
);

assert.ok(
  css.includes('#theme-select,\n#puter-model {'),
  'Puter model select should share the base theme select styling'
);

assert.ok(
  css.includes('body.light-mode #theme-select,\nbody.light-mode #puter-model {'),
  'Puter model select should share light-mode theme select styling'
);

console.log('options dropdown styles ok');

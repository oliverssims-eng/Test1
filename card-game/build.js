/* Builds the single-file distribution: inlines style.css and all js/ files
   into index.html and writes ../Grimveil.html (repo root).
   Run with: node card-game/build.js                                        */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

html = html.replace('<link rel="stylesheet" href="style.css">',
  () => '<style>\n' + fs.readFileSync(path.join(dir, 'style.css'), 'utf8') + '\n</style>');

html = html.replace(/<script src="js\/(\w+)\.js"><\/script>/g,
  (m, name) => '<script>\n' + fs.readFileSync(path.join(dir, 'js', name + '.js'), 'utf8') + '\n</script>');

if (/<script src=/.test(html) || /<link rel="stylesheet"/.test(html)){
  console.error('build failed: some references were not inlined');
  process.exit(1);
}

const out = path.join(dir, '..', 'Grimveil.html');
fs.writeFileSync(out, html);
console.log('wrote', out, '(' + fs.statSync(out).size + ' bytes)');

const fs = require('fs');
const path = require('path');
const dir = './frontend/src/pages';
fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.jsx')) {
    const p = path.join(dir, file);
    let contents = fs.readFileSync(p, 'utf8');
    contents = contents.replace(/localStorage\.getItem\(['"]token['"]\)/g, "sessionStorage.getItem('token')");
    contents = contents.replace(/localStorage\.setItem\(['"]token['"]/g, "sessionStorage.setItem('token'");
    contents = contents.replace(/localStorage\.removeItem\(['"]token['"]\)/g, "sessionStorage.removeItem('token')");
    fs.writeFileSync(p, contents);
  }
});
console.log('Update complete.');

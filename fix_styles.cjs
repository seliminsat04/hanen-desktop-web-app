// Style utilities
const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Simple global replaces for specific common combinations to avoid complex regex
  content = content.replace(/text-xs font-black/g, 'text-xs font-bold');
  content = content.replace(/text-\[10px\] font-black/g, 'text-[10px] font-bold');
  content = content.replace(/text-\[11px\] font-black/g, 'text-[11px] font-bold');
  content = content.replace(/text-\[9px\] font-black/g, 'text-[9px] font-bold');
  content = content.replace(/text-sm font-black/g, 'text-sm font-bold');

  content = content.replace(/font-black text-xs/g, 'font-bold text-xs');
  content = content.replace(/font-black text-\[10px\]/g, 'font-bold text-[10px]');
  content = content.replace(/font-black text-\[11px\]/g, 'font-bold text-[11px]');
  content = content.replace(/font-black text-\[9px\]/g, 'font-bold text-[9px]');
  content = content.replace(/font-black text-sm/g, 'font-bold text-sm');

  // Large sizes
  content = content.replace(/text-lg font-black/g, 'text-lg font-extrabold');
  content = content.replace(/text-xl font-black/g, 'text-xl font-extrabold');
  content = content.replace(/text-2xl font-black/g, 'text-2xl font-extrabold');
  content = content.replace(/text-3xl font-black/g, 'text-3xl font-extrabold');
  content = content.replace(/text-4xl font-black/g, 'text-4xl font-extrabold');
  content = content.replace(/text-5xl font-black/g, 'text-5xl font-extrabold');

  content = content.replace(/font-black text-lg/g, 'font-extrabold text-lg');
  content = content.replace(/font-black text-xl/g, 'font-extrabold text-xl');
  content = content.replace(/font-black text-2xl/g, 'font-extrabold text-2xl');
  content = content.replace(/font-black text-3xl/g, 'font-extrabold text-3xl');
  content = content.replace(/font-black text-4xl/g, 'font-extrabold text-4xl');
  content = content.replace(/font-black text-5xl/g, 'font-extrabold text-5xl');

  // Any remaining font-black that doesn't have a size next to it, we might want to just replace with font-extrabold if it's a big heading, but we'll leave it or replace it generally.
  // Actually, replacing all font-black with font-extrabold globally after the small ones are handled is a good idea.
  content = content.replace(/font-black/g, 'font-extrabold');

  fs.writeFileSync(filePath, content, 'utf8');
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  });
}

walkDir('./src');
console.log('Done!');

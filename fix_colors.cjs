// Color utilities
const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (!filePath.includes('Sidebar.tsx') && !filePath.includes('Login.tsx')) {
    // We want to avoid replacing placeholder:text-slate-400.
    // In JS we can use negative lookbehind: (?<!placeholder:)text-slate-400
    content = content.replace(/(?<!placeholder:)text-slate-400/g, 'text-slate-500');
  }

  // Also replace some bg-amber-500 text-white with bg-amber-100 text-amber-800 border-amber-300 if any exist
  // We already did this manually, but maybe there's one in Patients.tsx
  // patient.voiceHealthStatus === 'Attention' ? 'bg-amber-500' -> leave it, it's a dot indicator
  // text-[10px] text-amber-600 bg-amber-50 -> good.
  
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
console.log('Done fixing colors!');

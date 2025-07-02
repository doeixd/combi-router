const fs = require('fs');
const path = require('path');

// Replace '@doeixd/combi-router' imports with relative imports in the standalone components
function fixStandaloneFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace relative import with package import in standalone files
  content = content.replace(
    /from ['"]\.\/index['"]/g,
    "from '@doeixd/combi-router'"
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed standalone import in: ${filePath}`);
}

// Map actual filenames to their generated numbered counterparts
// We need to find which numbered file corresponds to components-standalone.ts

function findStandaloneFiles() {
  const directories = [
    'dist/esm/development',
    'dist/esm/production', 
    'dist/cjs/development',
    'dist/cjs/production'
  ];
  
  const standaloneFiles = [];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check if this file contains components-standalone content 
      // Look for the unique comment in components-standalone.ts
      if (content.includes('view-area') && content.includes('standalone version') && content.includes('./index')) {
        standaloneFiles.push(fullPath);
      }
    }
  }
  
  return standaloneFiles;
}

// For now, since we know it's file 2.js, let's directly fix those
const buildPaths = [
  'dist/esm/development/2.js',
  'dist/esm/production/2.js',
  'dist/cjs/development/2.js',
  'dist/cjs/production/2.js'
];

console.log('Fixing standalone component imports...');
buildPaths.forEach(fixStandaloneFile);

import fs from 'fs';
const content = fs.readFileSync('node_modules/@google/genai/dist/src/services/live.d.ts', 'utf-8');
console.log(content);

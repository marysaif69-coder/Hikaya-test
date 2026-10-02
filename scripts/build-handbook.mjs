// Copies knowledge/handbook.md into a module the Netlify functions can bundle.
// Runs before every build (npm run build) and test.
import fs from 'node:fs';
const md = fs.readFileSync('knowledge/handbook.md', 'utf8');
fs.writeFileSync('netlify/lib/handbook.gen.ts',
  `// Generated from knowledge/handbook.md by scripts/build-handbook.mjs. Edit the markdown, not this file.\nexport const HANDBOOK = ${JSON.stringify(md)};\n`);

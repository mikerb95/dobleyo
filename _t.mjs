import fs from 'node:fs';
const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
const buf = fs.readFileSync(process.argv[2]);
const d = await pdfParse(buf);
console.log(JSON.stringify(d.text.slice(0, 1800)));

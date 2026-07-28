import fs from 'node:fs';
import * as m from 'pdf-parse';
console.log('exports:', Object.keys(m));
const fn = m.pdf ?? m.default ?? m.PDFParse;
const buf = fs.readFileSync(process.argv[2]);
const d = await (typeof fn === 'function' ? fn(buf) : new m.PDFParse({ data: buf }).getText());
console.log(JSON.stringify((d.text||'').slice(0,1500)));

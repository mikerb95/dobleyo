import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';
const buf = fs.readFileSync(process.argv[2]);
const p = new PDFParse({ data: new Uint8Array(buf) });
const d = await p.getText();
await p.destroy();
console.log(JSON.stringify(d.text.slice(0, 2200)));

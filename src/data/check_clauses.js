import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { iatfData } from './iatfData.ts';

const flat = [];
function collect(clauses) {
  for (const c of clauses) {
    flat.push({
      number: c.number,
      title: c.title,
      textLength: c.text ? c.text.length : 0,
      snippet: c.text ? c.text.substring(0, 100) : ''
    });
    if (c.subClauses) {
      collect(c.subClauses);
    }
  }
}
collect(iatfData);

console.log(JSON.stringify(flat, null, 2));

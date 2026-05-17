import fs from 'node:fs';

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const srcPath = process.argv[2] ?? './docs/data/n3.csv';
const dstPath = process.argv[3] ?? './seed/words.csv';

const text = fs.readFileSync(srcPath, 'utf-8');
const lines = text.split(/\r?\n/).filter(l => l.length > 0);

const header = parseCsvLine(lines[0]).map(h => h.trim());
const iExpr = header.indexOf('expression');
const iReading = header.indexOf('reading');
const iMeaning = header.indexOf('meaning');
if (iExpr < 0 || iReading < 0 || iMeaning < 0) {
  throw new Error('CSV must have expression, reading, meaning columns');
}

const outRows: string[] = ['japanese,kana,chinese,group_key'];
for (const line of lines.slice(1)) {
  const cols = parseCsvLine(line);
  const japanese = (cols[iExpr] ?? '').trim();
  const kana = (cols[iReading] ?? '').trim();
  const chinese = (cols[iMeaning] ?? '').trim();
  if (!japanese || !chinese) continue;
  const csvKana = kana.includes(',') ? `"${kana}"` : kana;
  const csvChinese = chinese.includes(',') ? `"${chinese}"` : chinese;
  outRows.push(`${japanese},${csvKana},${csvChinese},N3`);
}

fs.writeFileSync(dstPath, outRows.join('\n') + '\n', 'utf-8');
console.log(`[convert] ${dstPath}: ${outRows.length - 1} rows`);

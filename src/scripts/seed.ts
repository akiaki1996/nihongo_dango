import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/lib/db';
import { countWords, insertWord } from '@/lib/queries';

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function runSeed(csvPath: string): void {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`seed CSV not found: ${csvPath}`);
  }
  if (countWords() > 0) {
    console.log('[seed] words table already populated, skipping.');
    return;
  }
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV has no data rows');
  }
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const iJp = header.indexOf('japanese');
  const iKana = header.indexOf('kana');
  const iCn = header.indexOf('chinese');
  const iGroup = header.indexOf('group_key');
  if (iJp < 0 || iCn < 0) {
    throw new Error('CSV header must contain japanese and chinese columns');
  }

  const tx = getDb().transaction((rows: string[][]) => {
    rows.forEach((cols, idx) => {
      const japanese = (cols[iJp] ?? '').trim();
      const chinese = (cols[iCn] ?? '').trim();
      if (!japanese) throw new Error(`row ${idx + 2}: japanese is empty`);
      if (!chinese) throw new Error(`row ${idx + 2}: chinese is empty`);
      const kanaRaw = iKana >= 0 ? (cols[iKana] ?? '').trim() : '';
      insertWord({
        japanese,
        kana: kanaRaw || null,
        chinese,
        group_key: iGroup >= 0 ? (cols[iGroup] ?? '').trim() || null : null,
      });
    });
  });
  const dataRows = lines.slice(1).map(parseCsvLine);
  tx(dataRows);
  console.log(`[seed] imported ${dataRows.length} words`);
}

// Run directly when invoked via tsx
const isMain = process.argv[1]?.endsWith('seed.ts');
if (isMain) {
  const csvPath = process.env.SEED_CSV ?? path.resolve('./seed/words.csv');
  runSeed(csvPath);
}

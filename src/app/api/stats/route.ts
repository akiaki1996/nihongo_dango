import { NextResponse } from 'next/server';
import { countWords } from '@/lib/queries';
import { getWrongBookCount } from '@/lib/wrongbook';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    totalWords: countWords(),
    wrongBookCount: getWrongBookCount(),
  });
}

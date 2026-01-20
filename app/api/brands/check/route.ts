import { NextRequest, NextResponse } from 'next/server';
import { searchBrand } from '@/lib/brands_db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { searches } = body as { searches: { md: string, mid: string, small: string, brand: string }[] };

        if (!searches || !Array.isArray(searches)) {
            return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
        }

        const results: { [key: string]: any } = {};

        // Process sequentially or parallel? Parallel is limited by sqlite concurrency but read is fine.
        // We can do it in a loop.
        for (const item of searches) {
            const { md, mid, small, brand } = item;

            // Construct a key to return
            const key = `${md}|${mid}|${small}|${brand}`;

            // Perform search
            const rows = await searchBrand(md, mid, small, brand);

            results[key] = {
                found: rows.length > 0,
                count: rows.length,
                details: rows // Return all rows or partial? Let's return all, assuming not huge per brand
            };
        }

        return NextResponse.json({ results });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

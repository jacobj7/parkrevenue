import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const OccupancyInputSchema = z.object({
  occupied_spaces: z.number().int().nonnegative(),
});

async function runPricingEngine(
  client: any,
  lotId: string,
  occupancyPct: number,
): Promise<number | null> {
  const ratesResult = await client.query(
    `SELECT id, min_occupancy_pct, max_occupancy_pct, rate_cents
     FROM pricing_rates
     WHERE lot_id = $1
       AND min_occupancy_pct <= $2
       AND max_occupancy_pct >= $2
     ORDER BY min_occupancy_pct DESC
     LIMIT 1`,
    [lotId, occupancyPct],
  );

  if (ratesResult.rows.length > 0) {
    return ratesResult.rows[0].rate_cents;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { lotId: string } },
) {
  const { lotId } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = OccupancyInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const { occupied_spaces } = parseResult.data;

  const client = await pool.connect();
  try {
    const lotResult = await client.query(
      `SELECT id, total_spaces FROM parking_lots WHERE id = $1`,
      [lotId],
    );

    if (lotResult.rows.length === 0) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const lot = lotResult.rows[0];
    const totalSpaces: number = lot.total_spaces;

    if (occupied_spaces > totalSpaces) {
      return NextResponse.json(
        {
          error: `occupied_spaces (${occupied_spaces}) cannot exceed total_spaces (${totalSpaces})`,
        },
        { status: 400 },
      );
    }

    const occupancyPct =
      totalSpaces > 0
        ? parseFloat(((occupied_spaces / totalSpaces) * 100).toFixed(2))
        : 0;

    const snapshotResult = await client.query(
      `INSERT INTO occupancy_snapshots (lot_id, occupied_spaces, total_spaces, occupancy_pct, recorded_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, lot_id, occupied_spaces, total_spaces, occupancy_pct, recorded_at`,
      [lotId, occupied_spaces, totalSpaces, occupancyPct],
    );

    const snapshot = snapshotResult.rows[0];

    const currentRateCents = await runPricingEngine(
      client,
      lotId,
      occupancyPct,
    );

    if (currentRateCents !== null) {
      await client.query(
        `UPDATE parking_lots SET current_rate_cents = $1, updated_at = NOW() WHERE id = $2`,
        [currentRateCents, lotId],
      );
    }

    return NextResponse.json(
      {
        snapshot: {
          id: snapshot.id,
          lot_id: snapshot.lot_id,
          occupied_spaces: snapshot.occupied_spaces,
          total_spaces: snapshot.total_spaces,
          occupancy_pct: parseFloat(snapshot.occupancy_pct),
          recorded_at: snapshot.recorded_at,
        },
        current_rate_cents: currentRateCents,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Error processing occupancy update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

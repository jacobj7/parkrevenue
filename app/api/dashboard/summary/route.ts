import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const summarySchema = z.object({
  total_lots: z.number(),
  average_occupancy: z.number(),
  active_pricing_rules_count: z.number(),
  lots_above_80_percent: z.number(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const operatorId = (session.user as { id?: string }).id;

    if (!operatorId) {
      return NextResponse.json(
        { error: "Operator ID not found in session" },
        { status: 401 },
      );
    }

    const client = await pool.connect();

    try {
      const totalLotsResult = await client.query(
        `SELECT COUNT(*) AS total_lots
         FROM lots
         WHERE operator_id = $1`,
        [operatorId],
      );

      const avgOccupancyResult = await client.query(
        `SELECT COALESCE(AVG(occupancy_rate), 0) AS average_occupancy
         FROM lots
         WHERE operator_id = $1`,
        [operatorId],
      );

      const activePricingRulesResult = await client.query(
        `SELECT COUNT(*) AS active_pricing_rules_count
         FROM pricing_rules pr
         JOIN lots l ON pr.lot_id = l.id
         WHERE l.operator_id = $1
           AND pr.is_active = true`,
        [operatorId],
      );

      const lotsAbove80Result = await client.query(
        `SELECT COUNT(*) AS lots_above_80_percent
         FROM lots
         WHERE operator_id = $1
           AND occupancy_rate > 80`,
        [operatorId],
      );

      const summary = summarySchema.parse({
        total_lots: parseInt(totalLotsResult.rows[0]?.total_lots ?? "0", 10),
        average_occupancy: parseFloat(
          avgOccupancyResult.rows[0]?.average_occupancy ?? "0",
        ),
        active_pricing_rules_count: parseInt(
          activePricingRulesResult.rows[0]?.active_pricing_rules_count ?? "0",
          10,
        ),
        lots_above_80_percent: parseInt(
          lotsAbove80Result.rows[0]?.lots_above_80_percent ?? "0",
          10,
        ),
      });

      return NextResponse.json(summary, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Data validation failed", details: error.errors },
        { status: 500 },
      );
    }

    console.error("Dashboard summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

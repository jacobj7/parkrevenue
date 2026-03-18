import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const pricingRuleSchema = z.object({
  threshold_pct: z
    .number()
    .min(0, "threshold_pct must be >= 0")
    .max(100, "threshold_pct must be <= 100"),
  rate_cents: z
    .number()
    .int("rate_cents must be an integer")
    .min(0, "rate_cents must be >= 0"),
  time_start: z
    .string()
    .regex(
      /^\d{2}:\d{2}(:\d{2})?$/,
      "time_start must be in HH:MM or HH:MM:SS format",
    )
    .nullable()
    .optional(),
  time_end: z
    .string()
    .regex(
      /^\d{2}:\d{2}(:\d{2})?$/,
      "time_end must be in HH:MM or HH:MM:SS format",
    )
    .nullable()
    .optional(),
  auto_apply: z.boolean().default(false),
});

async function verifyLotOwnership(
  lotId: string,
  userId: string,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id FROM lots WHERE id = $1 AND owner_id = $2",
      [lotId, userId],
    );
    return result.rowCount !== null && result.rowCount > 0;
  } finally {
    client.release();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { lotId: string } },
) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: missing user ID" },
        { status: 401 },
      );
    }

    const { lotId } = params;

    const isOwner = await verifyLotOwnership(lotId, userId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: you do not own this lot" },
        { status: 403 },
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, lot_id, threshold_pct, rate_cents, time_start, time_end, auto_apply, created_at, updated_at
         FROM pricing_rules
         WHERE lot_id = $1
         ORDER BY created_at ASC`,
        [lotId],
      );

      return NextResponse.json({ data: result.rows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET /api/lots/[lotId]/rates error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { lotId: string } },
) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: missing user ID" },
        { status: 401 },
      );
    }

    const { lotId } = params;

    const isOwner = await verifyLotOwnership(lotId, userId);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: you do not own this lot" },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = pricingRuleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 422 },
      );
    }

    const { threshold_pct, rate_cents, time_start, time_end, auto_apply } =
      parseResult.data;

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO pricing_rules (lot_id, threshold_pct, rate_cents, time_start, time_end, auto_apply, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, lot_id, threshold_pct, rate_cents, time_start, time_end, auto_apply, created_at, updated_at`,
        [
          lotId,
          threshold_pct,
          rate_cents,
          time_start ?? null,
          time_end ?? null,
          auto_apply,
        ],
      );

      return NextResponse.json({ data: result.rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/lots/[lotId]/rates error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

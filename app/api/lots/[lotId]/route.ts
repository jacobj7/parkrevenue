import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  total_spaces: z.number().int().positive().optional(),
  hourly_rate: z.number().positive().optional(),
  daily_rate: z.number().positive().optional(),
  monthly_rate: z.number().positive().optional(),
  is_active: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  amenities: z.array(z.string()).optional(),
  operating_hours: z.record(z.any()).optional(),
});

async function verifyOwnership(
  lotId: string,
  userId: string,
): Promise<boolean> {
  const result = await db.query(
    "SELECT id FROM lots WHERE id = $1 AND operator_id = $2",
    [lotId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { lotId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = params;

    const owned = await verifyOwnership(lotId, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { error: "Lot not found or access denied" },
        { status: 404 },
      );
    }

    const result = await db.query(
      `SELECT 
        l.*,
        COUNT(DISTINCT r.id) AS total_reservations,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) AS active_reservations
       FROM lots l
       LEFT JOIN reservations r ON r.lot_id = l.id
       WHERE l.id = $1 AND l.operator_id = $2
       GROUP BY l.id`,
      [lotId, session.user.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    return NextResponse.json({ lot: result.rows[0] });
  } catch (error) {
    console.error("GET /api/lots/[lotId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { lotId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = params;

    const owned = await verifyOwnership(lotId, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { error: "Lot not found or access denied" },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = patchSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 422 },
      );
    }

    const data = parseResult.data;
    const keys = Object.keys(data);

    if (keys.length === 0) {
      return NextResponse.json(
        { error: "No fields provided for update" },
        { status: 400 },
      );
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const key of keys) {
      const value = (data as Record<string, unknown>)[key];
      if (key === "amenities") {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else if (key === "operating_hours") {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(lotId);
    values.push(session.user.id);

    const query = `
      UPDATE lots
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex} AND operator_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: "Lot not found or update failed" },
        { status: 404 },
      );
    }

    return NextResponse.json({ lot: result.rows[0] });
  } catch (error) {
    console.error("PATCH /api/lots/[lotId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { lotId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lotId } = params;

    const owned = await verifyOwnership(lotId, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { error: "Lot not found or access denied" },
        { status: 404 },
      );
    }

    const activeReservations = await db.query(
      `SELECT COUNT(*) AS count FROM reservations 
       WHERE lot_id = $1 AND status = 'active'`,
      [lotId],
    );

    const activeCount = parseInt(activeReservations.rows[0]?.count ?? "0", 10);

    if (activeCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete lot with active reservations",
          active_reservations: activeCount,
        },
        { status: 409 },
      );
    }

    await db.query("DELETE FROM lots WHERE id = $1 AND operator_id = $2", [
      lotId,
      session.user.id,
    ]);

    return NextResponse.json(
      { message: "Lot deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("DELETE /api/lots/[lotId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

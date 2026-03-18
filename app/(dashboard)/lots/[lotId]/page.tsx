"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Lot {
  id: string;
  name: string;
  location: string;
  capacity: number;
  description: string | null;
  created_at: string;
}

interface OccupancyRecord {
  id: string;
  lot_id: string;
  occupied_spaces: number;
  recorded_at: string;
  notes: string | null;
}

interface ChartDataPoint {
  time: string;
  occupied: number;
  available: number;
  occupancyRate: number;
}

export default function LotDetailPage() {
  const params = useParams();
  const lotId = params?.lotId as string;

  const [lot, setLot] = useState<Lot | null>(null);
  const [occupancyHistory, setOccupancyHistory] = useState<OccupancyRecord[]>(
    [],
  );
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    occupied_spaces: "",
    notes: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!lotId) return;
    setLoading(true);
    setError(null);
    try {
      const [lotRes, occupancyRes] = await Promise.all([
        fetch(`/api/lots/${lotId}`),
        fetch(`/api/lots/${lotId}/occupancy`),
      ]);

      if (!lotRes.ok) {
        const errData = await lotRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to fetch lot: ${lotRes.status}`,
        );
      }
      if (!occupancyRes.ok) {
        const errData = await occupancyRes.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to fetch occupancy: ${occupancyRes.status}`,
        );
      }

      const lotData: Lot = await lotRes.json();
      const occupancyData: OccupancyRecord[] = await occupancyRes.json();

      setLot(lotData);
      setOccupancyHistory(occupancyData);

      const chart: ChartDataPoint[] = occupancyData
        .slice()
        .sort(
          (a, b) =>
            new Date(a.recorded_at).getTime() -
            new Date(b.recorded_at).getTime(),
        )
        .map((record) => {
          const occupied = record.occupied_spaces;
          const available = Math.max(0, lotData.capacity - occupied);
          const occupancyRate =
            lotData.capacity > 0
              ? Math.round((occupied / lotData.capacity) * 100)
              : 0;
          return {
            time: new Date(record.recorded_at).toLocaleString(),
            occupied,
            available,
            occupancyRate,
          };
        });

      setChartData(chart);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    const occupiedSpaces = parseInt(formData.occupied_spaces, 10);
    if (isNaN(occupiedSpaces) || occupiedSpaces < 0) {
      setFormError("Occupied spaces must be a non-negative number.");
      setFormLoading(false);
      return;
    }
    if (lot && occupiedSpaces > lot.capacity) {
      setFormError(
        `Occupied spaces cannot exceed lot capacity (${lot.capacity}).`,
      );
      setFormLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/lots/${lotId}/occupancy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupied_spaces: occupiedSpaces,
          notes: formData.notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to submit occupancy: ${res.status}`,
        );
      }

      setFormSuccess("Occupancy recorded successfully!");
      setFormData({ occupied_spaces: "", notes: "" });
      await fetchData();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading lot details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold text-lg mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Lot not found.</p>
      </div>
    );
  }

  const latestOccupancy =
    occupancyHistory.length > 0
      ? occupancyHistory.reduce((latest, record) =>
          new Date(record.recorded_at) > new Date(latest.recorded_at)
            ? record
            : latest,
        )
      : null;

  const currentOccupied = latestOccupancy?.occupied_spaces ?? 0;
  const currentAvailable = Math.max(0, lot.capacity - currentOccupied);
  const currentRate =
    lot.capacity > 0 ? Math.round((currentOccupied / lot.capacity) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Lot Info Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lot.name}</h1>
            <p className="text-gray-500 mt-1">{lot.location}</p>
            {lot.description && (
              <p className="text-gray-600 mt-2 text-sm">{lot.description}</p>
            )}
            <p className="text-gray-400 text-xs mt-2">
              Created: {new Date(lot.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                currentRate >= 90
                  ? "bg-red-100 text-red-800"
                  : currentRate >= 70
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-green-100 text-green-800"
              }`}
            >
              {currentRate}% Full
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{lot.capacity}</p>
            <p className="text-sm text-gray-500 mt-1">Total Capacity</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">
              {currentOccupied}
            </p>
            <p className="text-sm text-blue-500 mt-1">Occupied</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-700">
              {currentAvailable}
            </p>
            <p className="text-sm text-green-500 mt-1">Available</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-700">
              {occupancyHistory.length}
            </p>
            <p className="text-sm text-purple-500 mt-1">Records</p>
          </div>
        </div>

        {/* Occupancy Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Occupancy</span>
            <span>
              {currentOccupied} / {lot.capacity}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                currentRate >= 90
                  ? "bg-red-500"
                  : currentRate >= 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(currentRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Manual Occupancy Entry Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Record Occupancy
        </h2>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="occupied_spaces"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Occupied Spaces <span className="text-red-500">*</span>
            </label>
            <input
              id="occupied_spaces"
              name="occupied_spaces"
              type="number"
              min="0"
              max={lot.capacity}
              value={formData.occupied_spaces}
              onChange={handleFormChange}
              required
              placeholder={`0 – ${lot.capacity}`}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleFormChange}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
            />
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{formError}</p>
            </div>
          )}
          {formSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-green-600 text-sm">{formSuccess}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={formLoading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {formLoading ? "Saving..." : "Record Occupancy"}
          </button>
        </form>
      </div>

      {/* Occupancy Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Occupancy Over Time
        </h2>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
            <p className="text-gray-500 text-sm">
              No occupancy data available yet.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                angle={-35}
                textAnchor="end"
                interval="preserveStartEnd"
                height={70}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                domain={[0, lot.capacity]}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    occupied: "Occupied Spaces",
                    available: "Available Spaces",
                    occupancyRate: "Occupancy Rate (%)",
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    occupied: "Occupied",
                    available: "Available",
                    occupancyRate: "Rate (%)",
                  };
                  return labels[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="occupied"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="available"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="occupancyRate"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: "#8b5cf6" }}
                activeDot={{ r: 5 }}
                yAxisId={0}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Occupancy History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Occupancy History
        </h2>
        {occupancyHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">No records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recorded At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Occupied
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Available
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {occupancyHistory
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.recorded_at).getTime() -
                      new Date(a.recorded_at).getTime(),
                  )
                  .map((record) => {
                    const rate =
                      lot.capacity > 0
                        ? Math.round(
                            (record.occupied_spaces / lot.capacity) * 100,
                          )
                        : 0;
                    const available = Math.max(
                      0,
                      lot.capacity - record.occupied_spaces,
                    );
                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {new Date(record.recorded_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-700 font-medium">
                          {record.occupied_spaces}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-700 font-medium">
                          {available}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              rate >= 90
                                ? "bg-red-100 text-red-700"
                                : rate >= 70
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {record.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

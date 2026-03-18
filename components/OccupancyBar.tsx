"use client";

import React from "react";

interface OccupancyBarProps {
  percentage: number;
  label?: string;
  showPercentage?: boolean;
  height?: number;
}

function getColor(percentage: number): string {
  if (percentage < 50) {
    return "#22c55e";
  } else if (percentage < 80) {
    return "#eab308";
  } else {
    return "#ef4444";
  }
}

function getBackgroundColor(percentage: number): string {
  if (percentage < 50) {
    return "#dcfce7";
  } else if (percentage < 80) {
    return "#fef9c3";
  } else {
    return "#fee2e2";
  }
}

function getLabel(percentage: number): string {
  if (percentage < 50) {
    return "Low";
  } else if (percentage < 80) {
    return "Moderate";
  } else {
    return "High";
  }
}

export default function OccupancyBar({
  percentage,
  label,
  showPercentage = true,
  height = 20,
}: OccupancyBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const color = getColor(clampedPercentage);
  const backgroundColor = getBackgroundColor(clampedPercentage);
  const statusLabel = getLabel(clampedPercentage);

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ color, backgroundColor }}
            >
              {statusLabel}
            </span>
            {showPercentage && (
              <span className="text-sm font-bold" style={{ color }}>
                {Math.round(clampedPercentage)}%
              </span>
            )}
          </div>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height: `${height}px`,
          backgroundColor: "#e5e7eb",
        }}
        role="progressbar"
        aria-valuenow={clampedPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ? `${label} occupancy` : "Occupancy"}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-in-out"
          style={{
            width: `${clampedPercentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

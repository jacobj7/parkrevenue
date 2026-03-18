interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
  valueClassName?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function SummaryCard({
  title,
  value,
  subtitle,
  className = "",
  valueClassName = "",
  icon,
  trend,
}: SummaryCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          {title}
        </span>
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span
          className={`text-3xl font-bold text-gray-900 leading-none ${valueClassName}`}
        >
          {value}
        </span>
        {trend && (
          <span
            className={`text-sm font-medium mb-0.5 ${
              trend.isPositive ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {trend.isPositive ? "▲" : "▼"} {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-sm text-gray-400 leading-snug">{subtitle}</p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { z } from "zod";

const RuleSchema = z.object({
  id: z.number().optional(),
  lot_id: z.number().optional(),
  threshold: z.number().min(0).max(100),
  time_start: z.string().regex(/^\d{2}:\d{2}$/),
  time_end: z.string().regex(/^\d{2}:\d{2}$/),
  rate: z.number().min(0),
  auto_apply: z.boolean(),
});

type Rule = z.infer<typeof RuleSchema>;

interface ExistingRule extends Rule {
  id: number;
  lot_id: number;
  created_at?: string;
}

const defaultForm: Rule = {
  threshold: 50,
  time_start: "08:00",
  time_end: "18:00",
  rate: 0,
  auto_apply: false,
};

export default function PricingPage() {
  const params = useParams();
  const lotId = params?.lotId as string;

  const [rules, setRules] = useState<ExistingRule[]>([]);
  const [form, setForm] = useState<Rule>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof Rule, string>>>({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchRules = useCallback(async () => {
    setFetchLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/lots/${lotId}/rates`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch rules: ${res.status}`);
      }
      const data = await res.json();
      setRules(data.rules || data || []);
    } catch (err: unknown) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load pricing rules",
      );
    } finally {
      setFetchLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    if (lotId) {
      fetchRules();
    }
  }, [lotId, fetchRules]);

  const validate = (values: Rule): Partial<Record<keyof Rule, string>> => {
    const result: Partial<Record<keyof Rule, string>> = {};
    const parsed = RuleSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.errors.forEach((e) => {
        const field = e.path[0] as keyof Rule;
        result[field] = e.message;
      });
    }
    if (
      values.time_start &&
      values.time_end &&
      values.time_start >= values.time_end
    ) {
      result.time_end = "End time must be after start time";
    }
    return result;
  };

  const handleChange = (field: keyof Rule, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`/api/lots/${lotId}/rates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create rule: ${res.status}`);
      }

      setSubmitSuccess(true);
      setForm(defaultForm);
      await fetchRules();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create pricing rule",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ruleId: number) => {
    if (!confirm("Are you sure you want to delete this pricing rule?")) return;
    setDeletingId(ruleId);
    try {
      const res = await fetch(`/api/lots/${lotId}/rates/${ruleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete rule: ${res.status}`);
      }
      await fetchRules();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete rule");
    } finally {
      setDeletingId(null);
    }
  };

  const formatRate = (rate: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(rate);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pricing Rules</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure dynamic pricing rules for lot{" "}
            <span className="font-semibold">#{lotId}</span>
          </p>
        </div>

        {/* Rule Builder Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            Add New Pricing Rule
          </h2>
          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Threshold Slider */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Occupancy Threshold:{" "}
                  <span className="font-bold text-indigo-600">
                    {form.threshold}%
                  </span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Apply this rule when lot occupancy reaches this percentage
                </p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={form.threshold}
                  onChange={(e) =>
                    handleChange("threshold", Number(e.target.value))
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
                {errors.threshold && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.threshold}
                  </p>
                )}
              </div>

              {/* Time Start */}
              <div>
                <label
                  htmlFor="time_start"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Time
                </label>
                <input
                  id="time_start"
                  type="time"
                  value={form.time_start}
                  onChange={(e) => handleChange("time_start", e.target.value)}
                  className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.time_start
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300"
                  }`}
                />
                {errors.time_start && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.time_start}
                  </p>
                )}
              </div>

              {/* Time End */}
              <div>
                <label
                  htmlFor="time_end"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Time
                </label>
                <input
                  id="time_end"
                  type="time"
                  value={form.time_end}
                  onChange={(e) => handleChange("time_end", e.target.value)}
                  className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.time_end
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300"
                  }`}
                />
                {errors.time_end && (
                  <p className="mt-1 text-sm text-red-600">{errors.time_end}</p>
                )}
              </div>

              {/* Rate Input */}
              <div>
                <label
                  htmlFor="rate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Rate (USD per hour)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    id="rate"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.rate}
                    onChange={(e) =>
                      handleChange("rate", parseFloat(e.target.value) || 0)
                    }
                    className={`block w-full rounded-md border pl-7 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      errors.rate
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300"
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.rate && (
                  <p className="mt-1 text-sm text-red-600">{errors.rate}</p>
                )}
              </div>

              {/* Auto Apply Toggle */}
              <div className="flex items-center">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto Apply
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Automatically apply this rule when conditions are met
                  </p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.auto_apply}
                    onClick={() => handleChange("auto_apply", !form.auto_apply)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      form.auto_apply ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        form.auto_apply ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="mt-1 text-xs text-gray-500">
                    {form.auto_apply ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="mt-4 rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Submit Success */}
            {submitSuccess && (
              <div className="mt-4 rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-700">
                  Pricing rule created successfully!
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  "Add Pricing Rule"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Rules Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Existing Pricing Rules
            </h2>
          </div>

          {fetchLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg
                className="animate-spin h-8 w-8 text-indigo-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-3 text-gray-600">Loading rules...</span>
            </div>
          ) : fetchError ? (
            <div className="px-6 py-8 text-center">
              <div className="rounded-md bg-red-50 p-4 inline-block">
                <p className="text-sm text-red-700">{fetchError}</p>
              </div>
              <button
                onClick={fetchRules}
                className="mt-4 block mx-auto text-sm text-indigo-600 hover:text-indigo-500 underline"
              >
                Try again
              </button>
            </div>
          ) : rules.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No pricing rules
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new pricing rule above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Threshold
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Time Window
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Rate / hr
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Auto Apply
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${rule.threshold}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {rule.threshold}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {rule.time_start} – {rule.time_end}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatRate(rule.rate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            rule.auto_apply
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {rule.auto_apply ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          disabled={deletingId === rule.id}
                          className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {deletingId === rule.id ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-1 h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg
                                className="mr-1 h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

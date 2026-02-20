import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getOverviewAnalytics } from "@/lib/admin-analytics";
import { csvBuffer, multiSheetXlsxBuffer, type Row } from "@/lib/admin-export";

function parseDate(raw: string | null, fallbackEnd = false) {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (fallbackEnd) parsed.setHours(23, 59, 59, 999);
  return parsed;
}

function flattenOverview(rows: {
  kpiRows: Row[];
  gamesRows: Row[];
  trendRows: Row[];
}) {
  return [
    { section: "KPIs" },
    ...rows.kpiRows,
    { section: "Juegos" },
    ...rows.gamesRows,
    { section: "Tendencia" },
    ...rows.trendRows,
  ];
}

export async function GET(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "csv").toLowerCase();
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"), true);
  const mode = searchParams.get("mode") ?? "ALL";

  const analytics = await getOverviewAnalytics({ from, to, mode });
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const buffer = multiSheetXlsxBuffer([
      { name: "KPIs", rows: analytics.exportData.kpiRows },
      { name: "Juegos", rows: analytics.exportData.gamesRows },
      { name: "Tendencia", rows: analytics.exportData.trendRows },
    ]);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="analytics_overview_${stamp}.xlsx"`,
      },
    });
  }

  const csv = csvBuffer(flattenOverview(analytics.exportData));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics_overview_${stamp}.csv"`,
    },
  });
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getGameAnalyticsByCode } from "@/lib/admin-analytics";
import { csvBuffer, multiSheetXlsxBuffer, type Row } from "@/lib/admin-export";

function buildCsvRows(data: {
  summaryRows: Row[];
  roundsRows: Row[];
  submissionsRows: Row[];
  pipelineRows: Row[];
}) {
  const rows: Row[] = [];

  rows.push({ section: "Resumen" });
  rows.push(...data.summaryRows);
  rows.push({ section: "Rondas" });
  rows.push(...data.roundsRows);
  rows.push({ section: "Submissions" });
  rows.push(...data.submissionsRows);
  rows.push({ section: "Pipeline" });
  rows.push(...data.pipelineRows);

  return rows;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "csv").toLowerCase();

  const analytics = await getGameAnalyticsByCode(code);
  if (!analytics) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const buffer = multiSheetXlsxBuffer([
      { name: "Resumen", rows: analytics.exportData.summaryRows },
      { name: "Rondas", rows: analytics.exportData.roundsRows },
      { name: "Submissions", rows: analytics.exportData.submissionsRows },
      { name: "Pipeline", rows: analytics.exportData.pipelineRows },
    ]);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${analytics.game.accessCode}_${stamp}.xlsx"`,
      },
    });
  }

  const csv = csvBuffer(buildCsvRows(analytics.exportData));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${analytics.game.accessCode}_${stamp}.csv"`,
    },
  });
}

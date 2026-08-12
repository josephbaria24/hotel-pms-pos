import { useGetRevenueReport, useGetReservationReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import { useToast } from "@/hooks/use-toast";

function formatPhp(n: number) {
  return `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  reserved: "hsl(var(--primary))",
  checked_in: "hsl(142 76% 36%)",
  checked_out: "hsl(215 16% 47%)",
  cancelled: "hsl(0 84% 60%)",
  no_show: "hsl(38 92% 50%)",
};

export default function Reports() {
  const { toast } = useToast();
  const { data: revenue, isLoading: isRevLoading } = useGetRevenueReport();
  const { data: resReport, isLoading: isResLoading } = useGetReservationReport();

  const statusChartData =
    resReport?.statusCounts?.map((s) => ({
      status: s.status.replace(/_/g, " "),
      count: s.count,
      raw: s.status,
    })) ?? [];

  const printHtml = (html: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "800px";
    iframe.style.height = "1000px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    document.body.appendChild(iframe);

    const cleanup = () => {
      try {
        document.body.removeChild(iframe);
      } catch (e) {
        console.error(e);
      }
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(cleanup, 1000);
      } catch (e) {
        console.error(e);
        cleanup();
      }
    };

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    } else {
      cleanup();
    }
  };

  const handleExportPdf = () => {
    if (!revenue || !resReport) {
      toast({
        title: "No data to export",
        description: "Please wait until report data is loaded.",
        variant: "destructive",
      });
      return;
    }

    const dailyRows = revenue.dailyRevenue
      ?.map(
        (d) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">${d.date}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #16a34a;">${formatPhp(d.amount)}</td>
      </tr>
    `
      )
      .join("") || "<tr><td colspan='2' style='text-align:center; padding:15px; color:#888;'>No daily revenue records</td></tr>";

    const statusRows = resReport.statusCounts
      ?.map(
        (s) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-transform: capitalize;">${s.status.replace(/_/g, " ")}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${s.count}</td>
      </tr>
    `
      )
      .join("") || "<tr><td colspan='2' style='text-align:center; padding:15px; color:#888;'>No reservation status records</td></tr>";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hotel Performance Report</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 14px;
            line-height: 1.5;
          }
          .header-container {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 16px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .subtitle {
            font-size: 14px;
            color: #6b7280;
            margin-top: 4px;
          }
          .meta {
            text-align: right;
            font-size: 12px;
            color: #4b5563;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 6px;
            margin-top: 30px;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .revenue-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
          }
          .revenue-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            background: #f9fafb;
          }
          .revenue-card-title {
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .revenue-card-value {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
          }
          .revenue-card-value.primary {
            color: #16a34a;
          }
          .tables-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: 600;
            text-align: left;
            padding: 10px;
            font-size: 12px;
            text-transform: uppercase;
            border-bottom: 1px solid #e5e7eb;
          }
          .footer {
            margin-top: 50px;
            border-top: 1px dashed #d1d5db;
            padding-top: 16px;
            text-align: center;
            font-size: 11px;
            color: #9ca3af;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .revenue-grid {
              display: table;
              width: 100%;
            }
            .revenue-card {
              display: table-cell;
              width: 25%;
              background: #f9fafb !important;
            }
            .tables-container {
              display: block;
            }
            .table-block {
              width: 100%;
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div>
            <h1 class="title">PalawanSU Hotel</h1>
            <p class="subtitle">Performance & Revenue Report</p>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Currency:</strong> PHP (₱)</div>
          </div>
        </div>

        <div class="section-title">Financial Summary</div>
        <div class="revenue-grid">
          <div class="revenue-card">
            <div class="revenue-card-title">Today Revenue</div>
            <div class="revenue-card-value primary">${formatPhp(revenue.todayRevenue)}</div>
          </div>
          <div class="revenue-card">
            <div class="revenue-card-title">Week Revenue</div>
            <div class="revenue-card-value">${formatPhp(revenue.weekRevenue)}</div>
          </div>
          <div class="revenue-card">
            <div class="revenue-card-title">Month Revenue</div>
            <div class="revenue-card-value">${formatPhp(revenue.monthRevenue)}</div>
          </div>
          <div class="revenue-card">
            <div class="revenue-card-title">Total Revenue</div>
            <div class="revenue-card-value">${formatPhp(revenue.totalRevenue)}</div>
          </div>
        </div>

        <div class="tables-container">
          <div class="table-block">
            <div class="section-title">Daily Revenue (Last 7 Days)</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${dailyRows}
              </tbody>
            </table>
          </div>

          <div class="table-block">
            <div class="section-title">Reservations by Status</div>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th style="text-align: right;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${statusRows}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer">
          PalawanSU Hotel Property Management System &bull; Confidential &bull; Generated Automatically
        </div>
      </body>
      </html>
    `;

    printHtml(html);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Financial and operational performance.</p>
        </div>
        <Button variant="outline" type="button" onClick={handleExportPdf}>
          <FileText className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isRevLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : revenue ? (
          <>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Today Revenue</CardHeader>
              <CardContent className="text-2xl font-bold text-emerald-600">{formatPhp(revenue.todayRevenue)}</CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Week Revenue</CardHeader>
              <CardContent className="text-2xl font-bold">{formatPhp(revenue.weekRevenue)}</CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Month Revenue</CardHeader>
              <CardContent className="text-2xl font-bold">{formatPhp(revenue.monthRevenue)}</CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2 text-sm font-medium text-muted-foreground">Total Revenue</CardHeader>
              <CardContent className="text-2xl font-bold">{formatPhp(revenue.totalRevenue)}</CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Revenue (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[min(22rem,40vh)] min-h-[200px]">
            {isRevLoading ? (
              <Skeleton className="w-full h-full" />
            ) : revenue ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(v) => `₱${v}`} />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    formatter={(value: number) => [formatPhp(value), "Amount"]}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Reservations by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[min(22rem,38vh)] min-h-[200px]">
            {isResLoading ? (
              <Skeleton className="w-full h-full" />
            ) : statusChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="status" width={100} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip formatter={(value: number) => [value, "Count"]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.raw] ?? "hsl(var(--muted-foreground))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No reservation data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm flex flex-col min-h-0">
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ScrollableTablePane offsetRem={14} minVh={22} frameless className="pr-1">
              <Table>
                <TableHeader className="sticky top-0 z-[1] bg-background shadow-sm">
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isResLoading ? (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : statusChartData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                        No data
                      </TableCell>
                    </TableRow>
                  ) : (
                    resReport?.statusCounts?.map((s) => (
                      <TableRow key={s.status}>
                        <TableCell className="capitalize">{s.status.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-right font-medium">{s.count}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollableTablePane>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

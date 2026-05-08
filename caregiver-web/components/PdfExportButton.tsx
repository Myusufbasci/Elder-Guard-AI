'use client';

import { useRef, useState } from 'react';

interface PdfExportButtonProps {
  /** CSS selector or ref ID for the chart container to capture */
  chartContainerId: string;
  elderName: string;
  dateRange: string;
  anomalySummary?: Array<{
    metric: string;
    count: number;
    maxZScore: number;
  }>;
}

export default function PdfExportButton({
  chartContainerId,
  elderName,
  dateRange,
  anomalySummary = [],
}: PdfExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const container = document.getElementById(chartContainerId);
      if (!container) {
        console.error('[PDF] Chart container not found:', chartContainerId);
        return;
      }

      // Capture charts
      const canvas = await html2canvas(container, {
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Header
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      pdf.setTextColor(248, 250, 252);
      pdf.setFontSize(18);
      pdf.text('ElderCare Health Report', 15, 18);

      pdf.setFontSize(11);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Elder: ${elderName}`, 15, 26);
      pdf.text(`Period: ${dateRange}`, 15, 32);
      pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 15, 38);

      // Chart image
      const imgWidth = pageWidth - 30;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const maxImgHeight = pageHeight - 80;
      const finalHeight = Math.min(imgHeight, maxImgHeight);
      pdf.addImage(imgData, 'PNG', 15, 44, imgWidth, finalHeight);

      // Anomaly summary table (if any)
      if (anomalySummary.length > 0) {
        const tableY = 44 + finalHeight + 8;

        pdf.setFontSize(12);
        pdf.setTextColor(248, 250, 252);
        pdf.text('Anomaly Summary', 15, tableY);

        pdf.setFontSize(9);
        pdf.setTextColor(148, 163, 184);
        const headers = ['Metric', 'Anomalies', 'Max Z-Score'];
        const colWidths = [60, 40, 50];
        let x = 15;
        headers.forEach((h, i) => {
          pdf.text(h, x, tableY + 7);
          x += colWidths[i] ?? 40;
        });

        pdf.setTextColor(203, 213, 225);
        anomalySummary.forEach((row, idx) => {
          x = 15;
          const y = tableY + 13 + idx * 6;
          pdf.text(row.metric, x, y);
          x += colWidths[0] ?? 60;
          pdf.text(String(row.count), x, y);
          x += colWidths[1] ?? 40;
          pdf.text(row.maxZScore.toFixed(2), x, y);
        });
      }

      const filename = `eldercare-report-${elderName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('[PDF] Export failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      ref={buttonRef}
      id="pdf-export-button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Exporting…
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Export PDF
        </>
      )}
    </button>
  );
}

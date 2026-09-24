/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import {
  BACKYARD_BOLD_COLUMN,
  DAY_COLUMNS,
  backyardCells,
  backyardColumns,
  boldSegments,
  infoItems,
  periodCells,
  reportTitle,
  type Segment,
} from '../format';
import type { Report } from '../report';

// Keep words whole; the default hyphenation splits table text mid-word.
Font.registerHyphenationCallback((word) => [word]);

export const NAVY = '#1f3a5f';
export const ZEBRA = '#eef2f7';
const GRID = '#9aa3ad';
const INCH = 72;

/** Table font sizes tried in order until the report fits on one page. */
export const PDF_FONT_STEPS = [7.8, 7.3, 6.8] as const;

const DAY_WIDTHS = ['11%', '12%', '31%', '12%', '9%', '25%'];
const BACKYARD_WIDTHS = ['22%', '23%', '27%', '28%'];

const s = StyleSheet.create({
  page: {
    paddingVertical: 0.4 * INCH,
    paddingHorizontal: 0.4 * INCH,
    fontFamily: 'Helvetica',
    color: '#111111',
  },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  heading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: NAVY,
    marginTop: 8,
    marginBottom: 4,
  },
  line: { marginBottom: 3 },
  bold: { fontFamily: 'Helvetica-Bold' },
  table: { borderTopWidth: 0.3, borderLeftWidth: 0.3, borderColor: GRID, marginBottom: 4 },
  row: { flexDirection: 'row' },
  headRow: { flexDirection: 'row', backgroundColor: NAVY },
  cell: {
    borderRightWidth: 0.3,
    borderBottomWidth: 0.3,
    borderColor: GRID,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  headText: { color: '#ffffff', fontFamily: 'Helvetica-Bold' },
});

function Rich({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((seg, i) => (
        <Text key={i} style={seg.bold ? s.bold : undefined}>
          {seg.text}
        </Text>
      ))}
    </>
  );
}

function Table({
  columns,
  rows,
  widths,
  boldCell,
}: {
  columns: readonly string[];
  rows: string[][];
  widths: string[];
  boldCell?: (row: number, col: number) => boolean;
}) {
  return (
    <View style={s.table}>
      <View style={s.headRow} wrap={false}>
        {columns.map((c, i) => (
          <View key={i} style={[s.cell, { width: widths[i] }]}>
            <Text style={s.headText}>{c}</Text>
          </View>
        ))}
      </View>
      {rows.map((cells, r) => (
        <View
          key={r}
          style={[s.row, { backgroundColor: r % 2 === 1 ? ZEBRA : '#ffffff' }]}
          wrap={false}
        >
          {cells.map((text, c) => (
            <View key={c} style={[s.cell, { width: widths[c] }]}>
              <Text style={boldCell?.(r, c) ? s.bold : undefined}>{text}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReportPdf({ report, fontSize = 7.8 }: { report: Report; fontSize?: number }) {
  const rows = report.wind.rows;
  const info = infoItems(report);
  return (
    <Document title={reportTitle(report)} author="WindWise" creator="WindWise">
      <Page size="LETTER" orientation="landscape" style={[s.page, { fontSize }]}>
        <Text style={s.title}>{reportTitle(report)}</Text>
        {report.story ? <Text style={s.line}>{report.story}</Text> : null}

        <Text style={s.heading}>Day-by-Day Breakdown</Text>
        <Table
          columns={DAY_COLUMNS}
          rows={report.periods.map((p) => periodCells(p, report.units))}
          widths={DAY_WIDTHS}
        />
        <Text style={s.line}>
          {info.map((item, i) => (
            <Text key={item.label + i}>
              {i > 0 ? '  ·  ' : ''}
              <Text style={s.bold}>{item.label}:</Text> {item.text}
            </Text>
          ))}
        </Text>

        <Text style={s.heading}>Wind Strength — What Happens in Your Backyard</Text>
        <Text style={s.line}>
          <Rich segments={boldSegments(report.wind.summary)} />
        </Text>
        {rows ? (
          <Table
            columns={backyardColumns(report)}
            rows={rows.map(backyardCells)}
            widths={BACKYARD_WIDTHS}
            boldCell={(r, c) => c === BACKYARD_BOLD_COLUMN && rows[r]!.gustsBold}
          />
        ) : null}
        {report.wind.ruleOfThumb ? (
          <Text style={s.line}>
            <Text style={s.bold}>Rule of thumb:</Text>{' '}
            <Rich segments={boldSegments(report.wind.ruleOfThumb)} />
          </Text>
        ) : null}
        <Text style={s.line}>Source: {report.source}</Text>
      </Page>
    </Document>
  );
}

/** Number of pages in a rendered PDF. */
export function countPdfPages(pdf: Uint8Array): number {
  const text = Buffer.from(pdf).toString('latin1');
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

export class PdfTooLongError extends Error {
  constructor() {
    super('Range too long for one page — shorten it.');
  }
}

/**
 * Renders the report on exactly one landscape Letter page. Steps the font down
 * (7.8 → 7.3 → 6.8pt) on overflow; never spills onto a second page.
 */
export async function renderReportPdf(report: Report): Promise<Buffer> {
  for (const fontSize of PDF_FONT_STEPS) {
    const pdf = await renderToBuffer(<ReportPdf report={report} fontSize={fontSize} />);
    if (countPdfPages(pdf) === 1) return pdf;
  }
  throw new PdfTooLongError();
}

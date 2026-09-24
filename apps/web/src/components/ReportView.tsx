import {
  BACKYARD_BOLD_COLUMN,
  DAY_COLUMNS,
  backyardCells,
  backyardColumns,
  boldSegments,
  infoItems,
  periodCells,
  reportTitle,
  type Report,
} from '@windwise/shared';

function Rich({ text }: { text: string }) {
  return (
    <>
      {boldSegments(text).map((s, i) =>
        s.bold ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

function Table({
  caption,
  columns,
  rows,
  bold,
}: {
  caption: string;
  columns: readonly string[];
  rows: string[][];
  bold?: (row: number, col: number) => boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="grid">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((text, c) => (
                <td key={c}>{bold?.(r, c) ? <b>{text}</b> : text}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** HTML twin of the PDF: same order, columns and style tokens. */
export function ReportView({ report }: { report: Report }) {
  const rows = report.wind.rows;
  const info = infoItems(report);
  return (
    <article className="sheet" aria-label="Weather report">
      <h1 className="title">{reportTitle(report)}</h1>
      {report.story ? <p className="line">{report.story}</p> : null}

      <h2 className="heading">Day-by-Day Breakdown</h2>
      <Table
        caption="Day-by-day breakdown"
        columns={DAY_COLUMNS}
        rows={report.periods.map((p) => periodCells(p, report.units))}
      />
      <p className="line">
        {info.map((item, i) => (
          <span key={item.label + i}>
            {i > 0 ? ' · ' : ''}
            <b>{item.label}:</b> {item.text}
          </span>
        ))}
      </p>

      <h2 className="heading">Wind Strength — What Happens in Your Backyard</h2>
      <p className="line">
        <Rich text={report.wind.summary} />
      </p>
      {rows ? (
        <Table
          caption="What the wind does in your backyard"
          columns={backyardColumns(report)}
          rows={rows.map(backyardCells)}
          bold={(r, c) => c === BACKYARD_BOLD_COLUMN && rows[r]!.gustsBold}
        />
      ) : null}
      {report.wind.ruleOfThumb ? (
        <p className="line">
          <b>Rule of thumb:</b> <Rich text={report.wind.ruleOfThumb} />
        </p>
      ) : null}
      <p className="line">Source: {report.source}</p>
    </article>
  );
}

export function ReportSkeleton() {
  return (
    <div className="sheet skeleton" aria-busy="true" aria-label="Loading report">
      <div className="bar w60 tall" />
      <div className="bar w40" />
      <div className="bar w30 mid" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="bar w100" />
      ))}
      <div className="bar w40 mid" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="bar w100" />
      ))}
    </div>
  );
}

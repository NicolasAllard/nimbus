import type { ReactNode } from "react";

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-3 mb-1 text-base font-bold first:mt-0",
  2: "mt-3 mb-1 text-[0.95rem] font-bold first:mt-0",
  3: "mt-2.5 mb-1 text-sm font-semibold first:mt-0",
  4: "mt-2 mb-1 text-sm font-semibold first:mt-0",
  5: "mt-2 mb-1 text-sm font-semibold first:mt-0",
  6: "mt-2 mb-1 text-sm font-semibold first:mt-0",
};

const ALIGN_CLASSES = { left: "text-left", center: "text-center", right: "text-right" } as const;

/** True for lines that look like a markdown table row, i.e. contain at least one unescaped `|`. */
function isTableRow(line: string): boolean {
  return /\|/.test(line) && line.trim().length > 0;
}

/** True for the `|---|:---:|---:|` separator row that follows a table header. */
function isTableSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes("-");
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseTableAlignments(separatorLine: string): Array<keyof typeof ALIGN_CLASSES> {
  return splitTableRow(separatorLine).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

function renderTable(
  headerCells: string[],
  alignments: Array<keyof typeof ALIGN_CLASSES>,
  rows: string[][],
  key: number,
) {
  return (
    <div key={key} className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {headerCells.map((cell, columnIndex) => (
              <th
                key={columnIndex}
                className={`border border-white/15 px-2 py-1 font-semibold ${ALIGN_CLASSES[alignments[columnIndex] ?? "left"]}`}
              >
                {parseInline(cell, `th${key}-${columnIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <td
                  key={columnIndex}
                  className={`border border-white/15 px-2 py-1 ${ALIGN_CLASSES[alignments[columnIndex] ?? "left"]}`}
                >
                  {parseInline(cell, `td${key}-${rowIndex}-${columnIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders **bold** as <strong> and `inline code` as <code>; everything else is plain text. */
function parseInline(text: string, keyPrefix: string) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter((segment) => segment.length > 0)
    .map((segment, index) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return (
          <strong key={`${keyPrefix}-${index}`} className="font-semibold">
            {segment.slice(2, -2)}
          </strong>
        );
      }
      if (segment.startsWith("`") && segment.endsWith("`")) {
        return (
          <code key={`${keyPrefix}-${index}`} className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.85em]">
            {segment.slice(1, -1)}
          </code>
        );
      }
      return <span key={`${keyPrefix}-${index}`}>{segment}</span>;
    });
}

/** Renders **bold**, `#`-`######` headings, and `| ... |` markdown tables as their own styled blocks. */
export function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(
        <div key={lineIndex} className={HEADING_CLASSES[level]}>
          {parseInline(headingMatch[2], `h${lineIndex}`)}
        </div>,
      );
      lineIndex++;
      continue;
    }

    if (isTableRow(line) && lineIndex + 1 < lines.length && isTableSeparatorRow(lines[lineIndex + 1])) {
      const headerCells = splitTableRow(line);
      const alignments = parseTableAlignments(lines[lineIndex + 1]);
      const rows: string[][] = [];
      let rowIndex = lineIndex + 2;
      while (rowIndex < lines.length && isTableRow(lines[rowIndex])) {
        rows.push(splitTableRow(lines[rowIndex]));
        rowIndex++;
      }
      blocks.push(renderTable(headerCells, alignments, rows, lineIndex));
      lineIndex = rowIndex;
      continue;
    }

    blocks.push(<div key={lineIndex}>{parseInline(line, `l${lineIndex}`)}</div>);
    lineIndex++;
  }

  return <>{blocks}</>;
}

export const parseCsv = (input: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = input[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushField();
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }

    if (ch === "\r") continue;

    field += ch;
  }

  pushField();
  if (row.length > 1 || row[0] !== "" || rows.length === 0) pushRow();

  return rows;
};

export const toCsv = (rows: Array<Array<string | number | null | undefined>>) => {
  const esc = (v: string) => {
    const needsQuotes = /[",\n\r]/.test(v);
    const out = v.replace(/"/g, '""');
    return needsQuotes ? `"${out}"` : out;
  };

  return rows
    .map((r) =>
      r
        .map((cell) => {
          if (cell === null || cell === undefined) return "";
          return esc(String(cell));
        })
        .join(",")
    )
    .join("\n");
};


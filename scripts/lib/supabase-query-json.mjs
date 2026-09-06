/**
 * Parse `supabase db query --output-format json` stdout.
 *
 * The CLI may emit a complete JSON document plus extra stdout on CI/non-TTY
 * (version banners, login progress, a second JSON status object). Callers must
 * not JSON.parse the entire buffer.
 */

const CLI_CHATTER =
  /^(A new version of Supabase CLI\b|We recommend updating regularly\b|Initialising login role\b|Connecting to remote database\b|Dumping \b|Try rerunning the command\b|Finished supabase\b)/i;

export function scanJsonValue(text, start) {
  let i = start;
  while (i < text.length && /\s/.test(text[i])) {
    i += 1;
  }
  if (i >= text.length) {
    return null;
  }

  const first = text[i];
  if (first !== "{" && first !== "[") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = i; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return { start: i, end: index + 1 };
      }
    }
  }

  throw new Error("Supabase db query JSON was truncated.");
}

function skipAnsiAndSpace(text, start) {
  let i = start;
  while (i < text.length) {
    const char = text[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === "\u001b") {
      i += 1;
      if (text[i] === "[") {
        i += 1;
        while (i < text.length && !/[A-Za-z]/.test(text[i])) {
          i += 1;
        }
        if (i < text.length) {
          i += 1;
        }
      }
      continue;
    }
    break;
  }
  return i;
}

function skipChatterLine(text, start) {
  const end = text.indexOf("\n", start);
  const lineEnd = end === -1 ? text.length : end + 1;
  const line = text.slice(start, end === -1 ? text.length : end).replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").trim();
  if (!line || CLI_CHATTER.test(line)) {
    return lineEnd;
  }
  return start;
}

export function extractJsonValues(raw) {
  const text = String(raw ?? "");
  const values = [];
  let i = 0;

  while (i < text.length) {
    i = skipAnsiAndSpace(text, i);
    if (i >= text.length) {
      break;
    }

    const scanned = scanJsonValue(text, i);
    if (scanned) {
      values.push(JSON.parse(text.slice(scanned.start, scanned.end)));
      i = scanned.end;
      continue;
    }

    const skipped = skipChatterLine(text, i);
    if (skipped === i) {
      throw new Error(
        `Supabase db query stdout had leftover non-JSON at index ${i} (bytes=${text.length}, json_values=${values.length}).`,
      );
    }
    i = skipped;
  }

  return values;
}

export function parseSupabaseDbQueryRows(raw) {
  const values = extractJsonValues(raw);
  const withRows = values.filter(
    (value) => value != null && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.rows),
  );
  if (withRows.length > 0) {
    return withRows[withRows.length - 1].rows;
  }
  const arrays = values.filter((value) => Array.isArray(value));
  if (arrays.length === 1) {
    return arrays[0];
  }
  throw new Error(
    `Supabase db query JSON had no rows array (json_values=${values.length}, bytes=${String(raw ?? "").length}).`,
  );
}

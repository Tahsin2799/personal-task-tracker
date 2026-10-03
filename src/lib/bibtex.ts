/** A reference read from a BibTeX file, reduced to what an entry needs. */
export type BibEntry = {
  key: string;
  title: string;
  authors: string[];
  year?: string;
  venue?: string;
  doi?: string;
  url?: string;
};

const ACCENTS: Record<string, string> = {
  "'": "́", "`": "̀", "^": "̂", '"': "̈", "~": "̃",
  "=": "̄", ".": "̇", u: "̆", v: "̌", H: "̋", c: "̧", k: "̨",
};
const LETTERS: Record<string, string> = { ss: "ß", o: "ø", O: "Ø", ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", aa: "å", AA: "Å", l: "ł", L: "Ł", i: "ı" };

/** LaTeX markup to plain text: accents, escaped characters, formatting commands and grouping braces. */
export function latexToText(s: string) {
  return s
    // \'e, \'{e}, \'{\i}; letter accents (\v{s}, \c c) need a brace or space so \cite and friends are left alone.
    .replace(/\\([`'^"~=.])\s*\{?\\?([A-Za-z])\}?/g, (_, accent: string, letter: string) => letter + ACCENTS[accent])
    .replace(/\\([uvHck])(?:\{\\?([A-Za-z])\}|\s+([A-Za-z]))/g, (_, accent: string, a?: string, b?: string) => (a ?? b) + ACCENTS[accent])
    .replace(/\\(ss|ae|AE|oe|OE|aa|AA|[oOlLi])\b\s*(\{\})?/g, (_, l: string) => LETTERS[l])
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/\\[a-zA-Z]+\*?\s*/g, "")
    .replace(/[{}]/g, "")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Reads every @entry in a .bib file; @string macros are expanded, @comment and @preamble skipped. */
export function parseBibtex(src: string): BibEntry[] {
  const macros: Record<string, string> = Object.fromEntries(MONTHS.map((m) => [m, m]));
  const out: BibEntry[] = [];
  let i = 0;

  const skipSpace = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  // A {balanced} or "quoted" value, without its delimiters.
  const delimited = () => {
    const quoted = src[i] === '"';
    let depth = 0;
    const start = ++i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "\\") i++;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        if (depth === 0) break;
        depth--;
      } else if (quoted && ch === '"' && depth === 0) break;
    }
    return src.slice(start, i++);
  };
  const value = () => {
    let result = "";
    for (;;) {
      skipSpace();
      if (src[i] === "{" || src[i] === '"') result += delimited();
      else {
        const m = /^[^\s,#}\)]+/.exec(src.slice(i));
        const word = m?.[0] ?? "";
        i += word.length;
        result += /^\d+$/.test(word) ? word : (macros[word.toLowerCase()] ?? word);
      }
      skipSpace();
      if (src[i] !== "#") return result;
      i++;
    }
  };

  while ((i = src.indexOf("@", i)) !== -1) {
    i++;
    const type = (/^[A-Za-z]+/.exec(src.slice(i))?.[0] ?? "").toLowerCase();
    i += type.length;
    skipSpace();
    if (src[i] !== "{" && src[i] !== "(") continue;
    const end = src[i] === "{" ? "}" : ")";

    if (type === "comment" || type === "preamble") {
      if (end === "}") delimited();
      continue;
    }
    i++;
    const fields: Record<string, string> = {};
    let key = "";
    if (type !== "string") {
      const m = /^\s*([^,\s]*)\s*,/.exec(src.slice(i));
      if (!m) continue;
      key = m[1];
      i += m[0].length;
    }
    for (;;) {
      skipSpace();
      if (src[i] === end || i >= src.length) {
        i++;
        break;
      }
      const name = /^[A-Za-z][\w:.+-]*/.exec(src.slice(i))?.[0];
      if (!name) {
        i++;
        continue;
      }
      i += name.length;
      skipSpace();
      if (src[i] !== "=") continue;
      i++;
      fields[name.toLowerCase()] = value();
      skipSpace();
      if (src[i] === ",") i++;
    }

    if (type === "string") {
      Object.assign(macros, Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v])));
      continue;
    }
    const title = latexToText(fields.title ?? "");
    if (!title) continue;
    const doi = fields.doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:/i, "");
    out.push({
      key,
      title,
      authors: (fields.author ?? fields.editor ?? "")
        .split(/\s+and\s+/i)
        .map((a) => latexToText(a))
        .filter((a) => a && a.toLowerCase() !== "others")
        .map((a) => (a.includes(",") ? a.split(",").slice(1).join(",").trim() + " " + a.split(",")[0].trim() : a)),
      year: /\d{4}/.exec(fields.year ?? fields.date ?? "")?.[0],
      venue: latexToText(fields.journal ?? fields.journaltitle ?? fields.booktitle ?? fields.school ?? fields.publisher ?? "") || undefined,
      doi: doi || undefined,
      url: fields.url?.trim() || undefined,
    });
  }
  return out;
}

/** "Wen, Mehta and Chowdhury" / "Wen, Mehta et al." for a one-line byline. */
export function shortAuthors(authors: string[]) {
  const last = (a: string) => a.split(" ").at(-1) ?? a;
  if (authors.length === 0) return "";
  if (authors.length <= 2) return authors.map(last).join(" and ");
  if (authors.length === 3) return `${last(authors[0])}, ${last(authors[1])} and ${last(authors[2])}`;
  return `${last(authors[0])}, ${last(authors[1])} et al.`;
}

/** The entry's notes: a citation line, then the DOI or URL (which the drawer turns into a reference link). */
export function referenceNotes(e: BibEntry) {
  const byline = [e.authors.join(", "), e.year && `(${e.year})`].filter(Boolean).join(" ");
  const citation = [byline, e.venue].filter(Boolean).join(". ");
  const link = e.doi ? `https://doi.org/${e.doi}` : e.url;
  return [citation && `${citation}.`, link].filter(Boolean).join("\n");
}

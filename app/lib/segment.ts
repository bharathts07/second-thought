/**
 * Clause segmentation. Pure, synchronous, no model.
 *
 * Two things make this file load-bearing rather than incidental.
 *
 * First, offsets. Every offset a segment carries indexes the ORIGINAL draft,
 * because the composer highlights and replaces against what the person actually
 * typed. The invariant `draft.slice(start, end) === segment.text` holds for
 * every segment by construction here, since `text` is produced by that exact
 * slice and never by any transformation. Excisions (code, backticks, URLs) are
 * replaced with equal-length whitespace instead of being deleted, which is the
 * one trick that removes almost all offset arithmetic from the project: a
 * masked copy is always the same length as the original, so an index into one is
 * an index into the other.
 *
 * Second, clause level rather than sentence level. Measured on the shipped
 * model, `we guarantee your data never leaves the US` scores 0.964 against the
 * residency exemplars on its own, and 0.197 once it sits inside one natural
 * sentence alongside a promise to send a report. Mean pooling averages the
 * promise away across the surrounding tokens. Sentence-level segmentation would
 * therefore make the most common real draft undetectable, so a comma plus a
 * conjunction is a boundary here and a long run is split even when the writer
 * never reached for punctuation at all.
 *
 * Deliberately NOT done: Unicode normalisation of the draft. NFC can change
 * string length, which would invalidate every offset. Normalisation belongs in
 * `embeddingText`, where offsets no longer matter.
 */

import type { Segment } from "@/app/lib/types";

/** Beyond this the UI says only the first part of the message was checked. */
export const MAX_SEGMENTS = 40;

/**
 * Character count, not word count, so `we guarantee no leaks` at 21 characters
 * still scans. Measured against the text that would actually be embedded, so a
 * fragment that is nothing but an excised URL counts as empty.
 */
export const MIN_SEGMENT_CHARS = 15;

/**
 * The dilution bound. A segment longer than this is split further even when it
 * contains no boundary the writer intended, because past roughly this length
 * mean pooling has already buried whatever the segment was about.
 */
export const MAX_SEGMENT_CHARS = 200;

type Span = { start: number; end: number };

const FENCED_CODE = /```[\s\S]*?(?:```|$)/g;
const INLINE_CODE = /`[^`\n]*`/g;
const URL = /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s]+/gi;
/** Trailing sentence punctuation belongs to the sentence, not to the link. */
const URL_TAIL = /[.,;:!?)\]}'"]+$/;

const HARD_PUNCT = new Set([".", "?", "!", ";"]);
/** A closing quote or bracket after terminal punctuation still ends that clause. */
const CLOSERS = new Set(['"', "'", ")", "]", "}", "’", "”"]);

/**
 * Soft boundaries: a comma plus a coordinating conjunction, or a spaced dash.
 * `\b` after the conjunction keeps `, sometimes` from matching `, so`. The dash
 * forms are written as escapes so the source of a project that bans them in
 * prose does not carry a literal one.
 */
const SOFT_BOUNDARY = /,\s+(?:and|but|so|then|which)\b|\s+[\u2014\u2013]\s+/gi;
/** The separator characters a soft boundary may consist of, for resume position. */
const SOFT_SEPARATOR = /[^\s,\u2014\u2013]/;

/** Emphasis markers, heading and quote markers. Stripped for embedding only. */
const MARKUP = /[*_~`#>]+/g;
/** Pictographs plus the joiner and variation selector that bind sequences. */
const EMOJI =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f]/gu;
const HAS_CONTENT = /[\p{L}\p{N}]/u;

/**
 * Replace code blocks, backticked spans and URLs with equal-length whitespace.
 * Newlines survive masking: a newline is a hard boundary, and turning the ones
 * inside a fenced block into spaces would let the text before the fence join the
 * text after it into one nonsense clause.
 */
export function maskExcisions(input: string): string {
  // Split by code unit rather than by code point: offsets in this project are
  // UTF-16 indices because that is what `String.prototype.slice` takes, and
  // `Array.from` would renumber every position after an emoji.
  const units = input.split("");

  const blank = (start: number, end: number): void => {
    for (let i = start; i < end && i < units.length; i++) {
      if (units[i] !== "\n") units[i] = " ";
    }
  };

  for (const m of input.matchAll(FENCED_CODE)) {
    blank(m.index, m.index + m[0].length);
  }
  let masked = units.join("");

  for (const m of masked.matchAll(INLINE_CODE)) {
    blank(m.index, m.index + m[0].length);
  }
  masked = units.join("");

  for (const m of masked.matchAll(URL)) {
    const trimmed = m[0].replace(URL_TAIL, "");
    blank(m.index, m.index + trimmed.length);
  }
  return units.join("");
}

/**
 * The text an embedder should see for a segment: excisions blanked, markup and
 * emoji stripped, whitespace collapsed, NFC-normalised. Display and replacement
 * always use `segment.text` instead, which is the untouched original.
 *
 * Cue matching belongs on this string too, not on the raw text, or `we
 * **guarantee** it` fails to match the cue `guarantee`.
 */
export function embeddingText(text: string): string {
  return maskExcisions(text.normalize("NFC"))
    .replace(EMOJI, " ")
    .replace(MARKUP, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Length of what would be embedded, which is what the two bounds care about. */
function informativeLength(masked: string, span: Span): number {
  return masked
    .slice(span.start, span.end)
    .replace(/\s+/g, " ")
    .trim().length;
}

function trimSpan(masked: string, span: Span): Span {
  let { start, end } = span;
  while (start < end && /\s/.test(masked[start])) start++;
  while (end > start && /\s/.test(masked[end - 1])) end--;
  return { start, end };
}

/** A period between two digits is a decimal point, not the end of a sentence. */
function isDecimalPoint(masked: string, i: number): boolean {
  return /\d/.test(masked[i - 1] ?? "") && /\d/.test(masked[i + 1] ?? "");
}

function hardSpans(masked: string): Span[] {
  const spans: Span[] = [];
  let start = 0;
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === "\n") {
      spans.push({ start, end: i });
      start = i + 1;
      continue;
    }
    if (!HARD_PUNCT.has(ch)) continue;
    if (ch === "." && isDecimalPoint(masked, i)) continue;
    let j = i + 1;
    while (j < masked.length && (HARD_PUNCT.has(masked[j]) || CLOSERS.has(masked[j]))) j++;
    spans.push({ start, end: j });
    start = j;
    i = j - 1;
  }
  // A draft with no terminal punctuation is ONE span here, not zero. That is the
  // common case in chat, and it goes on to clause splitting like any other.
  if (start < masked.length) spans.push({ start, end: masked.length });
  return spans;
}

function softSplit(masked: string, span: Span): Span[] {
  const text = masked.slice(span.start, span.end);
  const spans: Span[] = [];
  let cursor = span.start;
  // `matchAll` iterates on a clone, so the shared literal's lastIndex is safe.
  for (const m of text.matchAll(SOFT_BOUNDARY)) {
    const cutAt = span.start + m.index;
    if (cutAt <= cursor) continue;
    // Resume at the conjunction itself so the comma and the dash fall between
    // the two spans rather than dangling on either one.
    const resumeRel = m[0].search(SOFT_SEPARATOR);
    const resumeAt =
      resumeRel === -1 ? cutAt + m[0].length : span.start + m.index + resumeRel;
    spans.push({ start: cursor, end: cutAt });
    cursor = resumeAt;
  }
  spans.push({ start: cursor, end: span.end });
  return spans;
}

/**
 * Where to cut a span that is over the dilution bound and had no soft boundary.
 * A bare comma is the best available clause hint; a word boundary is the next
 * choice. A fixed-width cut is the reserve mechanism, used only when the window
 * holds neither, because it cuts mid-token and produces a junk embedding for
 * that piece. Leaving the span whole instead is worse: a 250-character
 * unbroken token followed by real prose would put the promise clause inside a
 * 300-character segment, which is exactly the dilution this bound exists to
 * stop.
 */
function findLengthCut(masked: string, span: Span): number | null {
  let count = 0;
  let prevWasSpace = true;
  let lastComma = -1;
  let lastSpace = -1;
  let atBound = -1;
  for (let i = span.start; i < span.end; i++) {
    const ch = masked[i];
    const isSpace = /\s/.test(ch);
    if (!(isSpace && prevWasSpace)) count++;
    prevWasSpace = isSpace;
    if (count >= MIN_SEGMENT_CHARS) {
      if (ch === ",") lastComma = i + 1;
      else if (isSpace) lastSpace = i;
    }
    if (count >= MAX_SEGMENT_CHARS && atBound === -1) atBound = i + 1;
    if (count > MAX_SEGMENT_CHARS) break;
  }
  const cut = lastComma > 0 ? lastComma : lastSpace > 0 ? lastSpace : atBound;
  if (cut <= span.start || cut >= span.end) return null;
  return cut;
}

function boundLength(masked: string, span: Span): Span[] {
  const out: Span[] = [];
  let cur = span;
  // The guard is belt and braces: findLengthCut always moves the cursor
  // forward, but an unbounded while loop over user input deserves a ceiling.
  for (let guard = 0; guard < MAX_SEGMENTS * 4; guard++) {
    if (informativeLength(masked, cur) <= MAX_SEGMENT_CHARS) break;
    const cut = findLengthCut(masked, cur);
    if (cut === null) break;
    out.push({ start: cur.start, end: cut });
    cur = { start: cut, end: cur.end };
  }
  out.push(cur);
  return out;
}

/**
 * Every clause boundary in the text, with no minimum length and no cap.
 *
 * This is the shared definition of "same clause": the negator scoping in
 * `negation.ts` asks the same question this function answers, and one module
 * owning it is what keeps the two from drifting apart.
 */
export function clauseSpans(input: string): Segment[] {
  const masked = maskExcisions(input);
  const out: Segment[] = [];
  for (const sentence of hardSpans(masked)) {
    for (const clause of softSplit(masked, sentence)) {
      for (const bounded of boundLength(masked, clause)) {
        const span = trimSpan(masked, bounded);
        if (span.end <= span.start) continue;
        out.push({
          text: input.slice(span.start, span.end),
          start: span.start,
          end: span.end,
        });
      }
    }
  }
  return out;
}

/**
 * Segment a draft into scannable clauses.
 *
 * Fragments under `MIN_SEGMENT_CHARS` of embeddable content are dropped, as is
 * anything with no letter or digit left after excision, so whitespace-only and
 * punctuation-only drafts yield zero segments rather than one empty one.
 */
export function segment(draft: string): { segments: Segment[]; truncated: boolean } {
  const masked = maskExcisions(draft);
  const kept = clauseSpans(draft).filter((s) => {
    const span = { start: s.start, end: s.end };
    if (!HAS_CONTENT.test(masked.slice(s.start, s.end))) return false;
    return informativeLength(masked, span) >= MIN_SEGMENT_CHARS;
  });
  return {
    segments: kept.slice(0, MAX_SEGMENTS),
    truncated: kept.length > MAX_SEGMENTS,
  };
}

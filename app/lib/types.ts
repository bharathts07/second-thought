/**
 * Shared contracts. Every module in the engine imports from here, so this file
 * is the interface between independently-built pieces. Changing a type here is
 * a cross-cutting change; adding one is not.
 */

export type Severity = "high" | "medium" | "low";

export type RecipientKind = "internal" | "external-guest" | "external-domain";

export type Recipient = {
  kind: RecipientKind;
  label: string;
  domain?: string;
};

export type RuleSource = "company" | "personal";

export type RuleCategory =
  | "claim"
  | "commitment"
  | "channel"
  | "disclosure"
  | "tone"
  | "language";

/**
 * How a rule decides whether a segment matches.
 *
 * `semantic` is a CONJUNCTION, not a similarity threshold. A finding is emitted
 * only when a cue is present, no negator governs that cue, AND cosine clears
 * the threshold. Measured on this exact model, the negated sentence
 * "we cannot guarantee your data never leaves the US" scores 0.978 against the
 * residency exemplars while the affirmative promise scores 0.964: the refusal
 * outscores the promise. Mean-pooled MiniLM encodes topic and vocabulary, not
 * stance, so no threshold alone can separate them. The embedding supplies
 * recall; the cue and negator gate supplies meaning.
 *
 * `terms` matches literal substrings. Never compile a term as a pattern: terms
 * are user-authored, and `f**k` or `(sic)` would throw as a regex and take the
 * whole scan down with it.
 */
export type Match =
  | { kind: "semantic"; cues: string[]; exemplars: string[]; threshold: number }
  | { kind: "terms"; terms: string[]; wholeWord: boolean };

export type PolicyRule = {
  id: string;
  source: RuleSource;
  enabled: boolean;
  title: string;
  category: RuleCategory;
  severity: Severity;
  /** Which recipient contexts activate this rule. Tone and language apply internally too. */
  appliesTo: RecipientKind[];
  match: Match;
  /** Two sentences, plain, about the risk rather than the person. */
  why: string;
  /** Optional: a terms rule may have no single sensible rewrite. */
  replacement?: string;
};

/** A span of the draft, with offsets that index the ORIGINAL string. */
export type Segment = {
  text: string;
  start: number;
  end: number;
};

export type Finding = {
  ruleId: string;
  ruleSource: RuleSource;
  title: string;
  severity: Severity;
  category: RuleCategory;
  why: string;
  replacement?: string;
  /**
   * The exact matched text. The accept path locates its target by trying the
   * stored span first, then the nearest occurrence of this string, because a
   * draft can legitimately contain the same sentence twice and offsets alone
   * are not an identity.
   */
  matchedText: string;
  start: number;
  end: number;
  source: "pattern" | "semantic";
  /** Semantic findings only. Surfaced in the UI: it is what distinguishes this from a keyword filter. */
  score?: number;
};

export type ScanResult = {
  findings: Finding[];
  /** True when the draft exceeded the segment cap and only its first part was checked. */
  truncated: boolean;
  /**
   * False when the semantic rung did not run: no model, a load failure, an
   * inference rejection, or a rule the matcher could not evaluate. The UI must
   * distinguish this from a clean draft. A silent false negative is the worst
   * possible output of a scan.
   */
  ranSemantic: boolean;
  /**
   * False when a rule in the deterministic rung could not be evaluated, which
   * `ranSemantic` cannot express without lying.
   *
   * This exists because a user-authored term rule is the likeliest thing in the
   * product to be malformed: a term containing regex metacharacters is caught
   * per rule so it cannot take the scan down, but "contained" and "ran" are
   * different claims, and reporting a clean draft for a rule that never
   * executed is exactly the failure the rung's error handling was added to
   * prevent.
   */
  ranPattern: boolean;
};

/**
 * The seam that makes the engine testable. Injected rather than imported, so
 * the semantic rung, the dedupe precedence, and the out-of-order race guard can
 * all be exercised in Node with hand-written vectors and no 23MB download.
 */
export type Embed = (texts: string[]) => Promise<Float32Array[]>;

export type DeviceKind = "webgpu" | "wasm";

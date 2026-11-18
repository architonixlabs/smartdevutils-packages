/** A ready-made tool chain shipped with the site (data/recipe-library.ts). Only ids are stored; names come from the registry. */
export interface BuiltinRecipe {
  /** Stable kebab-case id; saved copies point at it through `basedOn`. */
  id: string;
  name: string;
  /** One sentence: the problem the chain solves. */
  description: string;
  /** A registry category id (core/constants/category.constants.ts). */
  category: string;
  /** Tool ids in run order (2-4). Each consecutive pair passes canPipe. */
  toolIds: readonly string[];
  /**
   * Synthetic input for step 1 (example.com, fake values), chosen so every step of the chain produces a real result.
   * Loaded when the recipe is run, replacing the first tool's own default.
   */
  sample: string;
  /**
   * The mode a step should open in when the tool's default would do the wrong thing with the piped value
   * (Base64 opens in Encode, a decode chain needs Decode). Keyed by tool id; the value is one of that tool's mode ids.
   */
  modes?: Readonly<Record<string, string>>;
  /**
   * Settings handed to a step together with the piped value, for a tool that needs more than its input to give a
   * result (a JSONPath expression). Keyed by tool id; never used for step 1.
   */
  options?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** One step of the recipe being run ("guided run"). */
export interface RecipePlanStep {
  toolId: string;
  slug: string;
  name: string;
  mode?: string;
  /** Settings piped to this step with the value (see BuiltinRecipe.options). */
  options?: Record<string, unknown>;
}

/** The recipe a visitor is working through, step by step. Kept in sessionStorage so a reload keeps it. */
export interface RecipePlan {
  name: string;
  steps: RecipePlanStep[];
  /** The step the visitor is on (0-based). */
  index: number;
  /** Input loaded into step 1 when the run starts; absent for a recipe without one (step 1 then starts empty). */
  sample?: string;
  /** The visitor cleared the sample, so returning to step 1 does not load it again. */
  sampleCleared?: boolean;
  /**
   * Replay: each step pipes its output on by itself as soon as it is ready, and the last one opens the run summary
   * (/recipes/run). Set by "Re-run" on the summary; any error or a step that gives no output stops it.
   */
  auto?: boolean;
  /** The built-in recipe this run came from, if any (kept in a downloaded run). */
  basedOn?: string;
}

/** What one step of a run received and produced, as recorded while it ran. */
export interface RecipeTraceStep {
  input: string;
  output: string;
  /** The tool's error message, when the step failed. */
  error?: string;
  /** The tool has no text output panel (an analyzer showing a report); `output` is then empty. */
  noOutputPanel?: boolean;
  /** `input` or `output` was cut to RUN_VALUE_MAX characters before it was stored. */
  truncated?: boolean;
}

/** The last recipe run in this tab: the steps as they ran and what each one did. Read by the run summary. */
export interface RecipeRun {
  name: string;
  basedOn?: string;
  steps: RecipePlanStep[];
  /** One entry per step that has run; null for a step not reached yet. */
  trace: (RecipeTraceStep | null)[];
  /** Set when a replay stopped early, with the reason. */
  stopped?: { index: number; reason: string };
  updatedAt: number;
}

/** The file format of "Download run" on the run summary: the recipe plus the data it ran on. */
export const RECIPE_RUN_SCHEMA = 'sdu-recipe-run/1';

export interface RecipeRunFile {
  schema: typeof RECIPE_RUN_SCHEMA;
  exportedAt: string;
  name: string;
  basedOn?: string;
  steps: { slug: string; mode?: string; options?: Record<string, unknown> }[];
  trace: (RecipeTraceStep | null)[];
}

/** The file format of "Download" / "Upload" on My Recipes. */
export const RECIPE_EXPORT_SCHEMA = 'sdu-recipes/1';

export interface RecipeExportEntry {
  name: string;
  description?: string;
  basedOn?: string;
  steps: { slug: string }[];
}

export interface RecipeExportFile {
  schema: typeof RECIPE_EXPORT_SCHEMA;
  exportedAt: string;
  recipes: RecipeExportEntry[];
}

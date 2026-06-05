// Multi-provider LLM layer built on LangChain.
//
// All network calls are routed through Tauri's HTTP plugin (`fetch` from
// @tauri-apps/plugin-http), which proxies requests through the Rust side and
// therefore bypasses the WebView's CORS restrictions. This is what lets us call
// provider APIs directly from the frontend with a key loaded from the config file.
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import type { AppSettings, ProviderId, Quadrant } from "./config";

// LangChain's typings expect the DOM fetch signature; the Tauri one is
// compatible at runtime, so we cast at the boundary.
const proxiedFetch = tauriFetch as unknown as typeof globalThis.fetch;

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  needsKey: boolean;
  defaultModel: string;
  modelHint: string;
  keyHint: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    needsKey: true,
    defaultModel: "claude-sonnet-4-20250514",
    modelHint: "e.g. claude-sonnet-4-20250514, claude-opus-4-20250514",
    keyHint: "Get a key at console.anthropic.com — starts with sk-ant-",
  },
  {
    id: "openai",
    label: "OpenAI",
    needsKey: true,
    defaultModel: "gpt-4o-mini",
    modelHint: "e.g. gpt-4o, gpt-4o-mini",
    keyHint: "Get a key at platform.openai.com — starts with sk-",
  },
  {
    id: "google",
    label: "Google Gemini",
    needsKey: true,
    defaultModel: "gemini-1.5-flash",
    modelHint: "e.g. gemini-1.5-flash, gemini-1.5-pro",
    keyHint: "Get a key at aistudio.google.com/app/apikey",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    needsKey: false,
    defaultModel: "llama3.1",
    modelHint: "any model you've pulled, e.g. llama3.1, mistral",
    keyHint: "No key needed — runs locally.",
  },
];

export function providerMeta(id: ProviderId): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/** True when the active provider has everything it needs to make a call. */
export function isConfigured(settings: AppSettings): boolean {
  const meta = providerMeta(settings.provider);
  const p = settings.providers[settings.provider];
  if (!p?.model) return false;
  return meta.needsKey ? !!p.apiKey : true;
}

function buildModel(settings: AppSettings): BaseChatModel {
  const id = settings.provider;
  const cfg = settings.providers[id];
  switch (id) {
    case "anthropic":
      return new ChatAnthropic({
        apiKey: cfg.apiKey,
        model: cfg.model,
        maxTokens: 1024,
        clientOptions: { fetch: proxiedFetch, dangerouslyAllowBrowser: true },
      });
    case "openai":
      return new ChatOpenAI({
        apiKey: cfg.apiKey,
        model: cfg.model,
        configuration: { fetch: proxiedFetch },
      });
    case "google":
      return new ChatGoogleGenerativeAI({
        apiKey: cfg.apiKey,
        model: cfg.model,
      });
    case "ollama":
      // The Ollama client uses global fetch (not the proxied one). Local calls
      // to 127.0.0.1 generally avoid CORS; if blocked, set OLLAMA_ORIGINS on the
      // Ollama server to allow the app origin.
      return new ChatOllama({
        baseUrl: cfg.baseUrl || "http://localhost:11434",
        model: cfg.model,
      });
  }
}

const VALID_QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];

export interface ExtractedTask {
  text: string;
  quadrant: Quadrant | "";
}

const QUADRANT_ASSIGNMENT_RULES = `Eisenhower quadrants — assign each task a "quadrant" field:
- "q1" Do First (urgent + important)
- "q2" Schedule (not urgent, important)
- "q3" Delegate (urgent, not important)
- "q4" Eliminate (not urgent, not important)
- "" only when you truly cannot guess; otherwise make your best guess

Return ONLY a raw JSON array of objects: [{"text":"...","quadrant":"q1"}, ...]. No preamble, no markdown fences.`;

// Default prompt — also surfaced (and editable) in Settings. `{dump}` and `{memory}` tokens.
export const DEFAULT_EXTRACTION_PROMPT = `You are a task extraction assistant. From the brain dump below, extract every actionable task.

Rules:
- Fix all spelling and grammar mistakes in the task text
- Merge duplicates and near-duplicates into one task (e.g. "call John" and "ring John" → keep one)
- Write each task as a clear, actionable phrase starting with a verb (max ~8 words)
- Discard vague non-tasks, filler words, or pure fluff (e.g. "I don't know", "maybe someday")
- Preserve the intent of every real task — don't drop anything actionable
{memory}
${QUADRANT_ASSIGNMENT_RULES}

Brain dump:
"""
{dump}
"""`;

const LEARN_SORT_PROMPT = `You maintain a compact markdown file of the user's Eisenhower matrix preferences. You will receive:
1. Their brain dump text
2. Each task with the model's initial quadrant guess ("suggested") and the user's final choice ("final")

Analyze patterns in what the user changed — what they treat as urgent vs not, important vs not. Merge insights with any existing memory below. Write the COMPLETE new memory file body (markdown only, no code fences). Use these sections when applicable:

## Urgent vs not urgent
(bullet rules)

## Important vs not important
(bullet rules)

## Examples
(short task → quadrant examples that capture their style)

Do not store session IDs or full brain dumps. Keep under ~80 lines. If the user made no meaningful corrections, refine wording but preserve prior lessons.

Existing memory:
"""
{existingMemory}
"""

Brain dump:
"""
{dump}
"""

Tasks (suggested → final):
{taskLines}`;

const META_PROMPT = `Summarise the brain dump below. Return ONLY a raw JSON object (no markdown fences, no preamble) of the form {"title": "...", "summary": "..."}.
- title: a short label, max 6 words, no surrounding quotes
- summary: one sentence, max 140 characters, capturing the gist

Brain dump:
"""
{dump}
"""`;

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c: any) => (typeof c === "string" ? c : c.text ?? "")).join("");
  }
  return String(content ?? "");
}

function normalizeQuadrant(raw: unknown): Quadrant | "" {
  if (raw === "" || raw == null) return "";
  const q = String(raw).trim().toLowerCase();
  return VALID_QUADRANTS.includes(q as Quadrant) ? (q as Quadrant) : "";
}

function parseExtractedTasks(cleaned: string): ExtractedTask[] {
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Model did not return a JSON array");
  return parsed
    .map((item): ExtractedTask | null => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { text, quadrant: "" } : null;
      }
      const text = String(item?.text ?? "").trim();
      if (!text) return null;
      return { text, quadrant: normalizeQuadrant(item?.quadrant) };
    })
    .filter((t): t is ExtractedTask => t !== null);
}

function buildExtractionPrompt(settings: AppSettings, dump: string, memory: string): string {
  const custom = settings.extractionPrompt?.trim();
  const base = custom || DEFAULT_EXTRACTION_PROMPT;
  const memBlock = memory.trim()
    ? `\nLearned Eisenhower preferences (from the user's past sorting):\n${memory.trim()}\n`
    : "";

  let prompt = base;
  if (prompt.includes("{memory}")) prompt = prompt.replace(/\{memory\}/g, memBlock);
  else if (memBlock) prompt = memBlock + "\n" + prompt;

  if (prompt.includes("{dump}")) prompt = prompt.replace(/\{dump\}/g, dump);
  else prompt = `${prompt}\n\n${dump}`;

  const needsQuadrantRules =
    !custom || (!custom.includes("quadrant") && !custom.includes("q1"));
  if (needsQuadrantRules && !prompt.includes("quadrant")) {
    prompt += `\n\n${QUADRANT_ASSIGNMENT_RULES}`;
  }
  return prompt;
}

/** Run the active provider on a brain dump and return tasks with quadrant guesses. */
export async function extractTasksWithQuadrants(
  settings: AppSettings,
  dump: string,
  memory = "",
): Promise<ExtractedTask[]> {
  const model = buildModel(settings);
  const res = await model.invoke([
    { role: "user", content: buildExtractionPrompt(settings, dump, memory) },
  ]);

  const cleaned = flattenContent(res.content).replace(/```json|```/g, "").trim();
  return parseExtractedTasks(cleaned);
}

/** Legacy: text-only extraction (no quadrant assignment). */
export async function extractTasks(settings: AppSettings, dump: string): Promise<string[]> {
  const tasks = await extractTasksWithQuadrants(settings, dump, "");
  return tasks.map((t) => t.text);
}

export interface SortLearningTask {
  text: string;
  suggested: Quadrant | "";
  final: Quadrant | "";
}

export interface SortLearningSession {
  dump: string;
  tasks: SortLearningTask[];
  existingMemory: string;
}

const QUADRANT_LABEL: Record<Quadrant | "", string> = {
  "": "unsorted",
  q1: "q1 Do First",
  q2: "q2 Schedule",
  q3: "q3 Delegate",
  q4: "q4 Eliminate",
};

/** Distill user sorting preferences into markdown for memory.md. */
export async function learnSortPreferences(
  settings: AppSettings,
  session: SortLearningSession,
): Promise<string> {
  const model = buildModel(settings);
  const taskLines = session.tasks
    .map((t) => `- "${t.text}": ${QUADRANT_LABEL[t.suggested]} → ${QUADRANT_LABEL[t.final]}`)
    .join("\n");

  const res = await model.invoke([
    {
      role: "user",
      content: LEARN_SORT_PROMPT.replace("{existingMemory}", session.existingMemory.trim() || "(empty)")
        .replace("{dump}", session.dump)
        .replace("{taskLines}", taskLines || "(no tasks)"),
    },
  ]);

  const body = flattenContent(res.content).replace(/^```(?:markdown|md)?\n?|```$/g, "").trim();
  if (!body) throw new Error("Model did not return memory content");
  return body;
}

export interface SessionMeta {
  title: string;
  summary: string;
}

/**
 * Ask the model for a short title + one-line summary of a dump. Best-effort:
 * callers should fall back to a local heuristic if this throws.
 */
export async function generateSessionMeta(settings: AppSettings, dump: string): Promise<SessionMeta> {
  const model = buildModel(settings);
  const res = await model.invoke([
    { role: "user", content: META_PROMPT.replace("{dump}", dump) },
  ]);
  const cleaned = flattenContent(res.content).replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const title = String(parsed?.title ?? "").trim();
  const summary = String(parsed?.summary ?? "").trim();
  if (!title) throw new Error("Model did not return a title");
  return { title: title.slice(0, 60), summary: summary.slice(0, 140) };
}

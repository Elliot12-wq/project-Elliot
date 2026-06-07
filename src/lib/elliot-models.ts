// Single source of truth for Elliot version tiers.
// Swap a `groqModel` here to retarget that whole tier — no other files need changes.

export type ElliotVersionId = "1.0" | "1.2" | "2.2" | "2.3";

export type ElliotVersion = {
  id: ElliotVersionId;
  label: string;        // shown in the picker: "Elliot 1.0"
  tagline: string;      // short blurb under the label
  groqModel: string;    // exact Groq model id sent in the API call
  temperature: number;
  supportsVision: boolean;
};

export const ELLIOT_VERSIONS: Record<ElliotVersionId, ElliotVersion> = {
  "1.0": {
    id: "1.0",
    label: "Elliot 1.0",
    tagline: "Fastest — instant replies",
    groqModel: "llama-3.1-8b-instant",
    temperature: 0.7,
    supportsVision: false,
  },
  "1.2": {
    id: "1.2",
    label: "Elliot 1.2",
    tagline: "Balanced — everyday assistant",
    groqModel: "llama-3.3-70b-versatile",
    temperature: 0.7,
    supportsVision: false,
  },
  "2.2": {
    id: "2.2",
    label: "Elliot 2.2",
    tagline: "Most accurate — careful, precise",
    groqModel: "moonshotai/kimi-k2-instruct",
    temperature: 0.3,
    supportsVision: false,
  },
  "2.3": {
    id: "2.3",
    label: "Elliot 2.3",
    tagline: "Best reasoning — deep, multi-step",
    groqModel: "openai/gpt-oss-120b",
    temperature: 0.6,
    supportsVision: false,
  },
};

export const DEFAULT_ELLIOT_VERSION: ElliotVersionId = "1.2";

// Fast model used for non-user-facing background work (title, memory extraction).
export const ELLIOT_UTILITY_MODEL = "llama-3.1-8b-instant";

// Vision-capable Groq model used whenever the user attaches images,
// regardless of which Elliot version is selected.
export const ELLIOT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export function getElliotVersion(id: string | undefined | null): ElliotVersion {
  if (id && id in ELLIOT_VERSIONS) return ELLIOT_VERSIONS[id as ElliotVersionId];
  return ELLIOT_VERSIONS[DEFAULT_ELLIOT_VERSION];
}

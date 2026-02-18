import { OpenClawAdapter } from "./openclawAdapter.js";
import type {
  LoadoutAdapter,
  LoadoutAdapterFactory,
} from "./types.js";

const factories = new Map<string, LoadoutAdapterFactory>([
  ["openclaw", () => new OpenClawAdapter()],
]);

export function registerLoadoutAdapter(
  id: string,
  factory: LoadoutAdapterFactory,
) {
  const key = id.trim().toLowerCase();
  if (!key) {
    throw new Error("Adapter id is required");
  }
  factories.set(key, factory);
}

export function listLoadoutAdapters() {
  return [...factories.keys()].sort();
}

export function resolveAdapterId(raw = process.env.LOBESTER_ADAPTER) {
  const normalized = (raw ?? "openclaw").trim().toLowerCase();
  return normalized || "openclaw";
}

export function createLoadoutAdapter(
  adapterId = resolveAdapterId(),
): LoadoutAdapter {
  const factory = factories.get(adapterId);
  if (!factory) {
    throw new Error(
      `Unknown LOBESTER_ADAPTER: ${adapterId}. Supported adapters: ${listLoadoutAdapters().join(", ")}`,
    );
  }
  return factory();
}


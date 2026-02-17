import { nanoid } from "nanoid";
import type {
  Preset,
  PresetGraph,
} from "@lobester/shared";
import { JsonCollectionStore } from "./jsonStore.js";
import { paths } from "./paths.js";

type PresetCreateInput = {
  name: string;
  skillIds: string[];
  graph?: PresetGraph;
};

type PresetUpdateInput = {
  name?: string;
  skillIds?: string[];
  graph?: PresetGraph;
};

export class PresetStore {
  private readonly store = new JsonCollectionStore<Preset>(
    paths.stateFiles.presets,
  );

  async ensure() {
    await paths.ensureRuntimeDirs();
    await this.store.ensure();
  }

  async list(): Promise<Preset[]> {
    await this.ensure();
    return this.store.readAll();
  }

  async getById(id: string): Promise<Preset | null> {
    await this.ensure();
    return this.store.getById(id);
  }

  async getByRef(ref: string): Promise<Preset | null> {
    await this.ensure();
    const entries = await this.store.readAll();
    const byId = entries.find((item) => item.id === ref);
    if (byId) return byId;
    return (
      entries.find(
        (item) =>
          item.name.toLowerCase() === ref.trim().toLowerCase(),
      ) ?? null
    );
  }

  async create(input: PresetCreateInput): Promise<Preset> {
    await this.ensure();
    const now = new Date().toISOString();
    const preset: Preset = {
      id: nanoid(),
      name: input.name.trim(),
      skillIds: input.skillIds,
      ...(input.graph ? { graph: input.graph } : {}),
      createdAt: now,
      updatedAt: now,
    };

    const all = await this.store.readAll();
    all.push(preset);
    await this.store.writeAll(all);
    return preset;
  }

  async update(
    id: string,
    input: PresetUpdateInput,
  ): Promise<Preset | null> {
    await this.ensure();
    const all = await this.store.readAll();
    const idx = all.findIndex((item) => item.id === id);
    if (idx < 0) return null;

    const existing = all[idx];
    const updated: Preset = {
      ...existing,
      ...(input.name === undefined
        ? {}
        : { name: input.name.trim() }),
      ...(input.skillIds === undefined
        ? {}
        : { skillIds: input.skillIds }),
      ...(input.graph === undefined
        ? {}
        : { graph: input.graph }),
      updatedAt: new Date().toISOString(),
    };

    all[idx] = updated;
    await this.store.writeAll(all);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    await this.ensure();
    return this.store.removeById(id);
  }
}


import { nanoid } from "nanoid";
import type {
  Run,
  RunStatus,
} from "@lobester/shared";
import { JsonCollectionStore } from "./jsonStore.js";
import { paths } from "./paths.js";

type RunCreateInput = {
  title: string;
  presetId: string;
};

type RunUpdateInput = {
  status?: RunStatus;
  outputMarkdown?: string;
};

export class RunStore {
  private readonly store = new JsonCollectionStore<Run>(
    paths.stateFiles.runs,
  );

  async ensure() {
    await paths.ensureRuntimeDirs();
    await this.store.ensure();
  }

  async list(): Promise<Run[]> {
    await this.ensure();
    const items = await this.store.readAll();
    return items.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async create(input: RunCreateInput): Promise<Run> {
    await this.ensure();
    const now = new Date().toISOString();
    const run: Run = {
      id: nanoid(),
      title: input.title.trim(),
      presetId: input.presetId,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };
    const runs = await this.store.readAll();
    runs.push(run);
    await this.store.writeAll(runs);
    return run;
  }

  async update(
    runId: string,
    input: RunUpdateInput,
  ): Promise<Run | null> {
    await this.ensure();
    const runs = await this.store.readAll();
    const idx = runs.findIndex((entry) => entry.id === runId);
    if (idx < 0) return null;

    const current = runs[idx];
    const next: Run = {
      ...current,
      ...(input.status === undefined
        ? {}
        : { status: input.status }),
      ...(input.outputMarkdown === undefined
        ? {}
        : { outputMarkdown: input.outputMarkdown }),
      updatedAt: new Date().toISOString(),
    };
    runs[idx] = next;
    await this.store.writeAll(runs);
    return next;
  }
}


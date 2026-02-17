import fs from "node:fs/promises";
import path from "node:path";

type JsonCollection<T> = {
  version: number;
  items: T[];
};

const SCHEMA_VERSION = 1;

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileAtomic(
  filePath: string,
  content: string,
) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}.tmp`;
  await fs.writeFile(tmpPath, content, "utf8");
  await fs.rename(tmpPath, filePath);
}

export class JsonCollectionStore<T extends { id: string }> {
  constructor(private readonly filePath: string) {}

  async ensure() {
    if (await exists(this.filePath)) return;
    const initial: JsonCollection<T> = {
      version: SCHEMA_VERSION,
      items: [],
    };
    await writeFileAtomic(
      this.filePath,
      JSON.stringify(initial, null, 2),
    );
  }

  async readAll(): Promise<T[]> {
    await this.ensure();
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as JsonCollection<T>;
    if (
      typeof parsed?.version !== "number" ||
      !Array.isArray(parsed.items)
    ) {
      throw new Error(`Invalid state file: ${this.filePath}`);
    }
    return parsed.items;
  }

  async writeAll(items: T[]) {
    const payload: JsonCollection<T> = {
      version: SCHEMA_VERSION,
      items,
    };
    await writeFileAtomic(
      this.filePath,
      JSON.stringify(payload, null, 2),
    );
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.readAll();
    return items.find((item) => item.id === id) ?? null;
  }

  async upsert(item: T) {
    const items = await this.readAll();
    const idx = items.findIndex((entry) => entry.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    await this.writeAll(items);
  }

  async removeById(id: string): Promise<boolean> {
    const items = await this.readAll();
    const next = items.filter((entry) => entry.id !== id);
    if (next.length === items.length) return false;
    await this.writeAll(next);
    return true;
  }
}

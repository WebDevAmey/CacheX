export class CacheEngine {
    private store = new Map<string, unknown>();

    set(key: string, value: unknown): void {
        this.store.set(key, value);
    }

    get(key: string): unknown {
        return this.store.get(key);
    }

    delete(key: string): boolean {
        return this.store.delete(key);
    }

    exists(key: string): boolean {
        return this.store.has(key);
    }

    keys(): string[] {
        return [...this.store.keys()];
    }

    clear(): void {
        this.store.clear();
    }
}
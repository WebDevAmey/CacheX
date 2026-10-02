type CacheEntry = {
    value: unknown;
    expiresAt: number | null;
};

export class CacheEngine {
    private store = new Map<string, CacheEntry>();

    set(key: string, value: unknown, ttl?: number) {
        const expiresAt =
            ttl !== undefined
                ? Date.now() + ttl * 1000
                : null;

        this.store.set(key, {
            value,
            expiresAt
        });
    }

    get(key: string) {
        const entry = this.store.get(key);

        if (!entry) {
            return undefined;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            return undefined;
        }

        return entry.value;
    }

    delete(key: string) {
        return this.store.delete(key);
    }

    exists(key: string) {
        return this.get(key) !== undefined;
    }

    keys() {
        const keys: string[] = [];

        for (const key of this.store.keys()) {
            if (this.get(key) !== undefined) {
                keys.push(key);
            }
        }

        return keys;
    }

    clear() {
        this.store.clear();
    }

    ttl(key: string) {
        const entry = this.store.get(key);

        if (!entry) {
            return -2;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            return -2;
        }

        if (entry.expiresAt === null) {
            return -1;
        }

        return Math.max(
            0,
            Math.ceil(
                (entry.expiresAt - Date.now()) / 1000
            )
        );
    }

    expire(key: string, seconds: number) {
        const entry = this.store.get(key);

        if (!entry || this.isExpired(entry)) {
            return false;
        }

        entry.expiresAt =
            Date.now() + seconds * 1000;

        return true;
    }

    persist(key: string) {
        const entry = this.store.get(key);

        if (!entry || this.isExpired(entry)) {
            return false;
        }

        entry.expiresAt = null;

        return true;
    }

    cleanupExpired() {
        let removed = 0;

        for (const [key, entry] of this.store) {
            if (this.isExpired(entry)) {
                this.store.delete(key);
                removed++;
            }
        }

        return removed;
    }

    private isExpired(entry: CacheEntry) {
        return (
            entry.expiresAt !== null &&
            entry.expiresAt <= Date.now()
        );
    }
}
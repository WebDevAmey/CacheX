type CacheEntry = {
    value: unknown;
    expiresAt: number | null;
};

export class CacheEngine {
    private store = new Map<string, CacheEntry>();

    private stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        gets: 0,
        deletes: 0,
        evictions: 0,
        expirations: 0,
        increments: 0,
        decrements: 0
    };

    private startedAt = Date.now();

    constructor(private maxKeys = 1000) {}

    set(key: string, value: unknown, ttl?: number) {
        this.stats.sets++;

        const expiresAt =
            ttl !== undefined
                ? Date.now() + ttl * 1000
                : null;

        if (this.store.has(key)) {
            this.store.delete(key);
        }

        if (this.store.size >= this.maxKeys) {
            const oldestKey = this.store.keys().next().value;

            if (oldestKey) {
                this.store.delete(oldestKey);
                this.stats.evictions++;
            }
        }

        this.store.set(key, {
            value,
            expiresAt
        });
    }

    get(key: string) {
        this.stats.gets++;

        const entry = this.store.get(key);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.misses++;
            this.stats.expirations++;
            return undefined;
        }

        this.stats.hits++;

        this.store.delete(key);
        this.store.set(key, entry);

        return entry.value;
    }

    delete(key: string) {
        const deleted = this.store.delete(key);

        if (deleted) {
            this.stats.deletes++;
        }

        return deleted;
    }

    exists(key: string) {
        const entry = this.store.get(key);

        if (!entry) {
            return false;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;
            return false;
        }

        return true;
    }

    keys() {
        const keys: string[] = [];

        for (const key of this.store.keys()) {
            if (this.exists(key)) {
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
            this.stats.expirations++;
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

    incr(key: string) {
        this.stats.increments++;

        const entry = this.store.get(key);

        if (!entry) {
            this.store.set(key, {
                value: 1,
                expiresAt: null
            });

            return 1;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);

            this.store.set(key, {
                value: 1,
                expiresAt: null
            });

            this.stats.expirations++;

            return 1;
        }

        if (typeof entry.value !== "number") {
            throw new Error("Value is not a number");
        }

        entry.value++;

        return entry.value;
    }

    decr(key: string) {
        this.stats.decrements++;

        const entry = this.store.get(key);

        if (!entry) {
            this.store.set(key, {
                value: -1,
                expiresAt: null
            });

            return -1;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);

            this.store.set(key, {
                value: -1,
                expiresAt: null
            });

            this.stats.expirations++;

            return -1;
        }

        if (typeof entry.value !== "number") {
            throw new Error("Value is not a number");
        }

        entry.value--;

        return entry.value;
    }

    cleanupExpired() {
        let removed = 0;

        for (const [key, entry] of this.store) {
            if (this.isExpired(entry)) {
                this.store.delete(key);
                this.stats.expirations++;
                removed++;
            }
        }

        return removed;
    }

    getStats() {
        const totalRequests =
            this.stats.hits + this.stats.misses;

        const hitRate =
            totalRequests === 0
                ? 0
                : (this.stats.hits / totalRequests) * 100;

        return {
            keys: this.store.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: Number(hitRate.toFixed(2)),
            sets: this.stats.sets,
            gets: this.stats.gets,
            deletes: this.stats.deletes,
            evictions: this.stats.evictions,
            expirations: this.stats.expirations,
            increments: this.stats.increments,
            decrements: this.stats.decrements,
            uptime: Math.floor(
                (Date.now() - this.startedAt) / 1000
            )
        };
    }

    private isExpired(entry: CacheEntry) {
        return (
            entry.expiresAt !== null &&
            entry.expiresAt <= Date.now()
        );
    }
}
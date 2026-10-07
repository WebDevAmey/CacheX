type RedisValue =
    | {
          type: "string";
          value: string;
      }
    | {
          type: "number";
          value: number;
      }
    | {
          type: "list";
          value: string[];
      };

type CacheEntry = {
    value: RedisValue;
    expiresAt: number | null;
};

type ListCacheEntry = {
    value: {
        type: "list";
        value: string[];
    };
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

        let redisValue: RedisValue;

        if (typeof value === "string") {
            redisValue = {
                type: "string",
                value
            };
        } else if (typeof value === "number") {
            redisValue = {
                type: "number",
                value
            };
        } else {
            throw new Error(
                "CacheX supports only strings and numbers with SET"
            );
        }

        const expiresAt =
            ttl !== undefined
                ? Date.now() + ttl * 1000
                : null;

        if (this.store.has(key)) {
            this.store.delete(key);
        }

        if (this.store.size >= this.maxKeys) {
            const oldestKey =
                this.store.keys().next().value;

            if (oldestKey) {
                this.store.delete(oldestKey);
                this.stats.evictions++;
            }
        }

        this.store.set(key, {
            value: redisValue,
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

        return entry.value.value;
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
                value: {
                    type: "number",
                    value: 1
                },
                expiresAt: null
            });

            return 1;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);

            this.store.set(key, {
                value: {
                    type: "number",
                    value: 1
                },
                expiresAt: null
            });

            this.stats.expirations++;

            return 1;
        }

        if (entry.value.type !== "number") {
            throw new Error("Value is not a number");
        }

        entry.value.value++;

        this.store.delete(key);
        this.store.set(key, entry);

        return entry.value.value;
    }

    decr(key: string) {
        this.stats.decrements++;

        const entry = this.store.get(key);

        if (!entry) {
            this.store.set(key, {
                value: {
                    type: "number",
                    value: -1
                },
                expiresAt: null
            });

            return -1;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);

            this.store.set(key, {
                value: {
                    type: "number",
                    value: -1
                },
                expiresAt: null
            });

            this.stats.expirations++;

            return -1;
        }

        if (entry.value.type !== "number") {
            throw new Error("Value is not a number");
        }

        entry.value.value--;

        this.store.delete(key);
        this.store.set(key, entry);

        return entry.value.value;
    }

    lpush(key: string, values: string[]) {
        const entry = this.getListEntry(key);

        if (!entry) {
            const list = [...values].reverse();

            this.store.set(key, {
                value: {
                    type: "list",
                    value: list
                },
                expiresAt: null
            });

            return list.length;
        }

        entry.value.value.unshift(...values);

        this.touch(key);

        return entry.value.value.length;
    }

    rpush(key: string, values: string[]) {
        const entry = this.getListEntry(key);

        if (!entry) {
            this.store.set(key, {
                value: {
                    type: "list",
                    value: [...values]
                },
                expiresAt: null
            });

            return values.length;
        }

        entry.value.value.push(...values);

        this.touch(key);

        return entry.value.value.length;
    }

    lpop(key: string) {
        const entry = this.getListEntry(key);

        if (!entry || entry.value.value.length === 0) {
            return undefined;
        }

        const value = entry.value.value.shift();

        this.touch(key);

        return value;
    }

    rpop(key: string) {
        const entry = this.getListEntry(key);

        if (!entry || entry.value.value.length === 0) {
            return undefined;
        }

        const value = entry.value.value.pop();

        this.touch(key);

        return value;
    }

    lrange(
        key: string,
        start: number,
        stop: number
    ) {
        const entry = this.getListEntry(key);

        if (!entry) {
            return [];
        }

        const list = entry.value.value;

        if (stop < 0) {
            stop = list.length + stop;
        }

        if (start < 0) {
            start = list.length + start;
        }

        if (start < 0) {
            start = 0;
        }

        if (stop >= list.length) {
            stop = list.length - 1;
        }

        if (start > stop || start >= list.length) {
            return [];
        }

        this.touch(key);

        return list.slice(start, stop + 1);
    }

    llen(key: string) {
        const entry = this.getListEntry(key);

        if (!entry) {
            return 0;
        }

        return entry.value.value.length;
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

    private getListEntry(key: string): ListCacheEntry | undefined {
        const entry = this.store.get(key);

        if (!entry) {
            return undefined;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;
            return undefined;
        }

        if (entry.value.type !== "list") {
            throw new Error("WRONGTYPE Key is not a list");
        }

        return entry as ListCacheEntry;
    }

    private touch(key: string) {
        const entry = this.store.get(key);

        if (!entry) {
            return;
        }

        this.store.delete(key);
        this.store.set(key, entry);
    }

    private isExpired(entry: CacheEntry) {
        return (
            entry.expiresAt !== null &&
            entry.expiresAt <= Date.now()
        );
    }
}
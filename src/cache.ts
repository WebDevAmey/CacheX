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
      }
    | {
          type: "set";
          value: Set<string>;
      }
    | {
          type: "hash";
          value: Map<string, string>;
      };

type CacheEntry = {
    value: RedisValue;
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
        decrements: 0,
        setAdds: 0,
        setRemoves: 0,
        hashSets: 0,
        hashDeletes: 0
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
                "SET supports only strings and numbers"
            );
        }

        const expiresAt =
            ttl !== undefined
                ? Date.now() + ttl * 1000
                : null;

        if (this.store.has(key)) {
            this.store.delete(key);
        }

        this.ensureCapacity();

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
        this.touch(key);

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
        const result: string[] = [];

        for (const key of this.store.keys()) {
            if (this.exists(key)) {
                result.push(key);
            }
        }

        return result;
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

        if (!entry) {
            return false;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;

            return false;
        }

        entry.expiresAt =
            Date.now() + seconds * 1000;

        return true;
    }

    persist(key: string) {
        const entry = this.store.get(key);

        if (!entry) {
            return false;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;

            return false;
        }

        entry.expiresAt = null;

        return true;
    }

    incr(key: string) {
        this.stats.increments++;

        let entry = this.store.get(key);

        if (entry && this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;
            entry = undefined;
        }

        if (!entry) {
            this.createEntry(key, {
                type: "number",
                value: 1
            });

            return 1;
        }

        if (entry.value.type !== "number") {
            throw new Error(
                "WRONGTYPE Key is not a number"
            );
        }

        entry.value.value++;

        this.touch(key);

        return entry.value.value;
    }

    decr(key: string) {
        this.stats.decrements++;

        let entry = this.store.get(key);

        if (entry && this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;
            entry = undefined;
        }

        if (!entry) {
            this.createEntry(key, {
                type: "number",
                value: -1
            });

            return -1;
        }

        if (entry.value.type !== "number") {
            throw new Error(
                "WRONGTYPE Key is not a number"
            );
        }

        entry.value.value--;

        this.touch(key);

        return entry.value.value;
    }

    lpush(key: string, values: string[]) {
        let entry = this.getListEntry(key);

        if (!entry) {
            this.createEntry(key, {
                type: "list",
                value: []
            });

            entry = this.getListEntry(key)!;
        }

        for (const value of values) {
            entry.value.value.unshift(value);
        }

        this.touch(key);

        return entry.value.value.length;
    }

    rpush(key: string, values: string[]) {
        let entry = this.getListEntry(key);

        if (!entry) {
            this.createEntry(key, {
                type: "list",
                value: []
            });

            entry = this.getListEntry(key)!;
        }

        entry.value.value.push(...values);

        this.touch(key);

        return entry.value.value.length;
    }

    lpop(key: string) {
        const entry = this.getListEntry(key);

        if (!entry) {
            return undefined;
        }

        const value = entry.value.value.shift();

        if (entry.value.value.length === 0) {
            this.store.delete(key);
        } else {
            this.touch(key);
        }

        return value;
    }

    rpop(key: string) {
        const entry = this.getListEntry(key);

        if (!entry) {
            return undefined;
        }

        const value = entry.value.value.pop();

        if (entry.value.value.length === 0) {
            this.store.delete(key);
        } else {
            this.touch(key);
        }

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
        const length = list.length;

        let actualStart =
            start < 0 ? length + start : start;

        let actualStop =
            stop < 0 ? length + stop : stop;

        actualStart = Math.max(0, actualStart);
        actualStop = Math.min(
            length - 1,
            actualStop
        );

        if (
            actualStart > actualStop ||
            actualStart >= length
        ) {
            return [];
        }

        this.touch(key);

        return list.slice(
            actualStart,
            actualStop + 1
        );
    }

    llen(key: string) {
        const entry = this.getListEntry(key);

        if (!entry) {
            return 0;
        }

        return entry.value.value.length;
    }

    sadd(key: string, members: string[]) {
        let entry = this.getSetEntry(key);

        if (!entry) {
            this.createEntry(key, {
                type: "set",
                value: new Set<string>()
            });

            entry = this.getSetEntry(key)!;
        }

        let added = 0;

        for (const member of members) {
            if (!entry.value.value.has(member)) {
                entry.value.value.add(member);
                added++;
            }
        }

        this.stats.setAdds += added;

        this.touch(key);

        return added;
    }

    srem(key: string, members: string[]) {
        const entry = this.getSetEntry(key);

        if (!entry) {
            return 0;
        }

        let removed = 0;

        for (const member of members) {
            if (entry.value.value.delete(member)) {
                removed++;
            }
        }

        this.stats.setRemoves += removed;

        if (entry.value.value.size === 0) {
            this.store.delete(key);
        } else {
            this.touch(key);
        }

        return removed;
    }

    sismember(key: string, member: string) {
        const entry = this.getSetEntry(key);

        if (!entry) {
            return false;
        }

        return entry.value.value.has(member);
    }

    smembers(key: string) {
        const entry = this.getSetEntry(key);

        if (!entry) {
            return [];
        }

        return Array.from(entry.value.value);
    }

    scard(key: string) {
        const entry = this.getSetEntry(key);

        if (!entry) {
            return 0;
        }

        return entry.value.value.size;
    }

    hset(
        key: string,
        field: string,
        value: string
    ) {
        let entry = this.getHashEntry(key);

        if (!entry) {
            this.createEntry(key, {
                type: "hash",
                value: new Map<string, string>()
            });

            entry = this.getHashEntry(key)!;
        }

        const isNew =
            !entry.value.value.has(field);

        entry.value.value.set(field, value);

        this.stats.hashSets++;

        this.touch(key);

        return isNew ? 1 : 0;
    }

    hget(key: string, field: string) {
        const entry = this.getHashEntry(key);

        if (!entry) {
            return undefined;
        }

        const value =
            entry.value.value.get(field);

        this.touch(key);

        return value;
    }

    hdel(key: string, fields: string[]) {
        const entry = this.getHashEntry(key);

        if (!entry) {
            return 0;
        }

        let deleted = 0;

        for (const field of fields) {
            if (entry.value.value.delete(field)) {
                deleted++;
            }
        }

        this.stats.hashDeletes += deleted;

        if (entry.value.value.size === 0) {
            this.store.delete(key);
        } else {
            this.touch(key);
        }

        return deleted;
    }

    hexists(key: string, field: string) {
        const entry = this.getHashEntry(key);

        if (!entry) {
            return false;
        }

        return entry.value.value.has(field);
    }

    hgetall(key: string) {
        const entry = this.getHashEntry(key);

        if (!entry) {
            return {};
        }

        const result: Record<string, string> = {};

        for (const [field, value] of entry.value.value) {
            result[field] = value;
        }

        this.touch(key);

        return result;
    }

    hkeys(key: string) {
        const entry = this.getHashEntry(key);

        if (!entry) {
            return [];
        }

        return Array.from(
            entry.value.value.keys()
        );
    }

    hvals(key: string) {
        const entry = this.getHashEntry(key);

        if (!entry) {
            return [];
        }

        return Array.from(
            entry.value.value.values()
        );
    }

    hlen(key: string) {
        const entry = this.getHashEntry(key);

        if (!entry) {
            return 0;
        }

        return entry.value.value.size;
    }

    type(key: string) {
        const entry = this.store.get(key);

        if (!entry) {
            return "none";
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;

            return "none";
        }

        return entry.value.type;
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
            this.stats.hits +
            this.stats.misses;

        const hitRate =
            totalRequests === 0
                ? 0
                : (this.stats.hits /
                      totalRequests) *
                  100;

        return {
            keys: this.store.size,
            maxKeys: this.maxKeys,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: Number(
                hitRate.toFixed(2)
            ),
            sets: this.stats.sets,
            gets: this.stats.gets,
            deletes: this.stats.deletes,
            evictions: this.stats.evictions,
            expirations: this.stats.expirations,
            increments: this.stats.increments,
            decrements: this.stats.decrements,
            setAdds: this.stats.setAdds,
            setRemoves: this.stats.setRemoves,
            hashSets: this.stats.hashSets,
            hashDeletes:
                this.stats.hashDeletes,
            uptime: Math.floor(
                (Date.now() -
                    this.startedAt) /
                    1000
            )
        };
    }

    private getListEntry(key: string) {
        const entry = this.getValidEntry(key);

        if (!entry) {
            return undefined;
        }

        if (entry.value.type !== "list") {
            throw new Error(
                "WRONGTYPE Key is not a list"
            );
        }

        return entry as CacheEntry & {
            value: Extract<
                RedisValue,
                { type: "list" }
            >;
        };
    }

    private getSetEntry(key: string) {
        const entry = this.getValidEntry(key);

        if (!entry) {
            return undefined;
        }

        if (entry.value.type !== "set") {
            throw new Error(
                "WRONGTYPE Key is not a set"
            );
        }

        return entry as CacheEntry & {
            value: Extract<
                RedisValue,
                { type: "set" }
            >;
        };
    }

    private getHashEntry(key: string) {
        const entry = this.getValidEntry(key);

        if (!entry) {
            return undefined;
        }

        if (entry.value.type !== "hash") {
            throw new Error(
                "WRONGTYPE Key is not a hash"
            );
        }

        return entry as CacheEntry & {
            value: Extract<
                RedisValue,
                { type: "hash" }
            >;
        };
    }

    private getValidEntry(key: string) {
        const entry = this.store.get(key);

        if (!entry) {
            return undefined;
        }

        if (this.isExpired(entry)) {
            this.store.delete(key);
            this.stats.expirations++;

            return undefined;
        }

        return entry;
    }

    private createEntry(
        key: string,
        value: RedisValue
    ) {
        this.ensureCapacity();

        this.store.set(key, {
            value,
            expiresAt: null
        });
    }

    private ensureCapacity() {
        if (this.store.size < this.maxKeys) {
            return;
        }

        const oldestKey =
            this.store.keys().next().value;

        if (oldestKey !== undefined) {
            this.store.delete(oldestKey);
            this.stats.evictions++;
        }
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
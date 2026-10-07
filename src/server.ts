import express from "express";
import { CacheEngine } from "./cache.js";

const app = express();
const cache = new CacheEngine(1000);

const PORT = 3000;

app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        name: "CacheX",
        status: "running"
    });
});

app.post("/set", (req, res) => {
    const { key, value, ttl } = req.body;

    if (!key || value === undefined) {
        return res.status(400).json({
            error: "key and value are required"
        });
    }

    if (
        ttl !== undefined &&
        (typeof ttl !== "number" || ttl <= 0)
    ) {
        return res.status(400).json({
            error: "ttl must be a positive number"
        });
    }

    try {
        cache.set(key, value, ttl);

        res.json({
            message: "OK",
            key,
            value,
            ttl: ttl ?? null
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.get("/get/:key", (req, res) => {
    const value = cache.get(req.params.key);

    if (value === undefined) {
        return res.status(404).json({
            error: "Key not found"
        });
    }

    res.json({
        key: req.params.key,
        value
    });
});

app.delete("/delete/:key", (req, res) => {
    const deleted = cache.delete(req.params.key);

    res.json({
        deleted
    });
});

app.get("/exists/:key", (req, res) => {
    res.json({
        exists: cache.exists(req.params.key)
    });
});

app.get("/keys", (_req, res) => {
    res.json({
        keys: cache.keys()
    });
});

app.delete("/clear", (_req, res) => {
    cache.clear();

    res.json({
        message: "Cache cleared"
    });
});

app.get("/ttl/:key", (req, res) => {
    const ttl = cache.ttl(req.params.key);

    res.json({
        key: req.params.key,
        ttl
    });
});

app.post("/expire/:key", (req, res) => {
    const { seconds } = req.body;

    if (
        typeof seconds !== "number" ||
        seconds <= 0
    ) {
        return res.status(400).json({
            error: "seconds must be a positive number"
        });
    }

    const success = cache.expire(
        req.params.key,
        seconds
    );

    if (!success) {
        return res.status(404).json({
            error: "Key not found"
        });
    }

    res.json({
        success: true
    });
});

app.post("/persist/:key", (req, res) => {
    const success = cache.persist(req.params.key);

    if (!success) {
        return res.status(404).json({
            error: "Key not found"
        });
    }

    res.json({
        success: true
    });
});

app.post("/incr/:key", (req, res) => {
    try {
        const value = cache.incr(req.params.key);

        res.json({
            key: req.params.key,
            value
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.post("/decr/:key", (req, res) => {
    try {
        const value = cache.decr(req.params.key);

        res.json({
            key: req.params.key,
            value
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.post("/lpush/:key", (req, res) => {
    const { values } = req.body;

    if (
        !Array.isArray(values) ||
        values.some(value => typeof value !== "string")
    ) {
        return res.status(400).json({
            error: "values must be an array of strings"
        });
    }

    try {
        const length = cache.lpush(
            req.params.key,
            values
        );

        res.json({
            key: req.params.key,
            length
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.post("/rpush/:key", (req, res) => {
    const { values } = req.body;

    if (
        !Array.isArray(values) ||
        values.some(value => typeof value !== "string")
    ) {
        return res.status(400).json({
            error: "values must be an array of strings"
        });
    }

    try {
        const length = cache.rpush(
            req.params.key,
            values
        );

        res.json({
            key: req.params.key,
            length
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.post("/lpop/:key", (req, res) => {
    try {
        const value = cache.lpop(req.params.key);

        if (value === undefined) {
            return res.status(404).json({
                error: "List is empty or key not found"
            });
        }

        res.json({
            value
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.post("/rpop/:key", (req, res) => {
    try {
        const value = cache.rpop(req.params.key);

        if (value === undefined) {
            return res.status(404).json({
                error: "List is empty or key not found"
            });
        }

        res.json({
            value
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.get("/lrange/:key", (req, res) => {
    const start = Number(req.query.start);
    const stop = Number(req.query.stop);

    if (
        !Number.isInteger(start) ||
        !Number.isInteger(stop)
    ) {
        return res.status(400).json({
            error: "start and stop must be integers"
        });
    }

    try {
        const values = cache.lrange(
            req.params.key,
            start,
            stop
        );

        res.json({
            values
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.get("/llen/:key", (req, res) => {
    try {
        const length = cache.llen(req.params.key);

        res.json({
            length
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.post("/sadd/:key", (req, res) => {
    const { members } = req.body;

    if (
        !Array.isArray(members) ||
        members.some(member => typeof member !== "string")
    ) {
        return res.status(400).json({
            error: "members must be an array of strings"
        });
    }

    try {
        const added = cache.sadd(
            req.params.key,
            members
        );

        res.json({
            key: req.params.key,
            added
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.post("/srem/:key", (req, res) => {
    const { members } = req.body;

    if (
        !Array.isArray(members) ||
        members.some(member => typeof member !== "string")
    ) {
        return res.status(400).json({
            error: "members must be an array of strings"
        });
    }

    try {
        const removed = cache.srem(
            req.params.key,
            members
        );

        res.json({
            key: req.params.key,
            removed
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.get("/sismember/:key/:member", (req, res) => {
    try {
        const exists = cache.sismember(
            req.params.key,
            req.params.member
        );

        res.json({
            member: req.params.member,
            exists
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.get("/smembers/:key", (req, res) => {
    try {
        const members = cache.smembers(req.params.key);

        res.json({
            members
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.get("/scard/:key", (req, res) => {
    try {
        const size = cache.scard(req.params.key);

        res.json({
            size
        });
    } catch (error) {
        res.status(400).json({
            error: (error as Error).message
        });
    }
});

app.get("/stats", (_req, res) => {
    res.json(cache.getStats());
});

const expirationWorker = setInterval(() => {
    const removed = cache.cleanupExpired();

    if (removed > 0) {
        console.log(
            `Expiration cleanup: removed ${removed} keys`
        );
    }
}, 1000);

const shutdown = () => {
    console.log("\nShutting down CacheX...");

    clearInterval(expirationWorker);

    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, () => {
    console.log(
        `CacheX running on http://localhost:${PORT}`
    );
});
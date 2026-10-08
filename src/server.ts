import express from "express";
import { CacheEngine } from "./cache.js";

const app = express();
const cache = new CacheEngine(1000);

const PORT = 3000;

app.use(express.json());

const handleError = (
    error: unknown,
    res: express.Response
) => {
    res.status(400).json({
        error:
            error instanceof Error
                ? error.message
                : "Unknown error"
    });
};

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

    try {
        cache.set(key, value, ttl);

        res.json({
            message: "OK"
        });
    } catch (error) {
        handleError(error, res);
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
    res.json({
        deleted: cache.delete(req.params.key)
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

app.get("/type/:key", (req, res) => {
    res.json({
        key: req.params.key,
        type: cache.type(req.params.key)
    });
});

app.get("/ttl/:key", (req, res) => {
    res.json({
        key: req.params.key,
        ttl: cache.ttl(req.params.key)
    });
});

app.post("/expire/:key", (req, res) => {
    const { seconds } = req.body;

    if (
        typeof seconds !== "number" ||
        seconds <= 0
    ) {
        return res.status(400).json({
            error:
                "seconds must be a positive number"
        });
    }

    const success = cache.expire(
        req.params.key,
        seconds
    );

    res.json({
        success
    });
});

app.post("/persist/:key", (req, res) => {
    res.json({
        success: cache.persist(req.params.key)
    });
});

app.post("/incr/:key", (req, res) => {
    try {
        res.json({
            value: cache.incr(req.params.key)
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/decr/:key", (req, res) => {
    try {
        res.json({
            value: cache.decr(req.params.key)
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/lpush/:key", (req, res) => {
    const { values } = req.body;

    if (
        !Array.isArray(values) ||
        values.some(
            value => typeof value !== "string"
        )
    ) {
        return res.status(400).json({
            error:
                "values must be an array of strings"
        });
    }

    try {
        res.json({
            length: cache.lpush(
                req.params.key,
                values
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/rpush/:key", (req, res) => {
    const { values } = req.body;

    if (
        !Array.isArray(values) ||
        values.some(
            value => typeof value !== "string"
        )
    ) {
        return res.status(400).json({
            error:
                "values must be an array of strings"
        });
    }

    try {
        res.json({
            length: cache.rpush(
                req.params.key,
                values
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/lpop/:key", (req, res) => {
    try {
        res.json({
            value:
                cache.lpop(req.params.key) ??
                null
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/rpop/:key", (req, res) => {
    try {
        res.json({
            value:
                cache.rpop(req.params.key) ??
                null
        });
    } catch (error) {
        handleError(error, res);
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
            error:
                "start and stop must be integers"
        });
    }

    try {
        res.json({
            values: cache.lrange(
                req.params.key,
                start,
                stop
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get("/llen/:key", (req, res) => {
    try {
        res.json({
            length: cache.llen(req.params.key)
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/sadd/:key", (req, res) => {
    const { members } = req.body;

    if (
        !Array.isArray(members) ||
        members.some(
            member => typeof member !== "string"
        )
    ) {
        return res.status(400).json({
            error:
                "members must be an array of strings"
        });
    }

    try {
        res.json({
            added: cache.sadd(
                req.params.key,
                members
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/srem/:key", (req, res) => {
    const { members } = req.body;

    if (!Array.isArray(members)) {
        return res.status(400).json({
            error: "members must be an array"
        });
    }

    try {
        res.json({
            removed: cache.srem(
                req.params.key,
                members
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get(
    "/sismember/:key/:member",
    (req, res) => {
        try {
            res.json({
                exists: cache.sismember(
                    req.params.key,
                    req.params.member
                )
            });
        } catch (error) {
            handleError(error, res);
        }
    }
);

app.get("/smembers/:key", (req, res) => {
    try {
        res.json({
            members: cache.smembers(
                req.params.key
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get("/scard/:key", (req, res) => {
    try {
        res.json({
            size: cache.scard(req.params.key)
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/hset/:key", (req, res) => {
    const { field, value } = req.body;

    if (
        typeof field !== "string" ||
        typeof value !== "string"
    ) {
        return res.status(400).json({
            error:
                "field and value must be strings"
        });
    }

    try {
        res.json({
            added: cache.hset(
                req.params.key,
                field,
                value
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get("/hget/:key/:field", (req, res) => {
    try {
        const value = cache.hget(
            req.params.key,
            req.params.field
        );

        res.json({
            value: value ?? null
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.post("/hdel/:key", (req, res) => {
    const { fields } = req.body;

    if (
        !Array.isArray(fields) ||
        fields.some(
            field => typeof field !== "string"
        )
    ) {
        return res.status(400).json({
            error:
                "fields must be an array of strings"
        });
    }

    try {
        res.json({
            deleted: cache.hdel(
                req.params.key,
                fields
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get(
    "/hexists/:key/:field",
    (req, res) => {
        try {
            res.json({
                exists: cache.hexists(
                    req.params.key,
                    req.params.field
                )
            });
        } catch (error) {
            handleError(error, res);
        }
    }
);

app.get("/hgetall/:key", (req, res) => {
    try {
        res.json({
            fields: cache.hgetall(
                req.params.key
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get("/hkeys/:key", (req, res) => {
    try {
        res.json({
            fields: cache.hkeys(req.params.key)
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get("/hvals/:key", (req, res) => {
    try {
        res.json({
            values: cache.hvals(
                req.params.key
            )
        });
    } catch (error) {
        handleError(error, res);
    }
});

app.get("/hlen/:key", (req, res) => {
    try {
        res.json({
            length: cache.hlen(req.params.key)
        });
    } catch (error) {
        handleError(error, res);
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
    clearInterval(expirationWorker);

    console.log("CacheX shutting down");

    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, () => {
    console.log(
        `CacheX running on http://localhost:${PORT}`
    );
});
import express from "express";
import { CacheEngine } from "./cache.js";

const app = express();
const cache = new CacheEngine(3);

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

    cache.set(key, value, ttl);

    res.json({
        message: "OK",
        key,
        value,
        ttl: ttl ?? null
    });
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
import express from "express";
import { CacheEngine } from "./cache.js";

const app = express();
const cache = new CacheEngine();

app.use(express.json());

// Health check
app.get("/", (_req, res) => {
    res.json({
        name: "CacheX",
        status: "running"
    });
});

// SET
app.post("/set", (req, res) => {
    const { key, value, ttl } = req.body;

    if (!key || value === undefined) {
        return res.status(400).json({
            error: "key and value are required"
        });
    }

    if (ttl !== undefined && typeof ttl !== "number") {
        return res.status(400).json({
            error: "ttl must be a number"
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

// GET
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

// DELETE
app.delete("/delete/:key", (req, res) => {
    const deleted = cache.delete(req.params.key);

    res.json({
        deleted
    });
});

// EXISTS
app.get("/exists/:key", (req, res) => {
    res.json({
        exists: cache.exists(req.params.key)
    });
});

// KEYS
app.get("/keys", (_req, res) => {
    res.json({
        keys: cache.keys()
    });
});

// CLEAR
app.delete("/clear", (_req, res) => {
    cache.clear();

    res.json({
        message: "Cache cleared"
    });
});

// TTL
app.get("/ttl/:key", (req, res) => {
    const ttl = cache.ttl(req.params.key);

    res.json({
        key: req.params.key,
        ttl
    });
});

// EXPIRE
app.post("/expire/:key", (req, res) => {
    const { seconds } = req.body;

    if (typeof seconds !== "number") {
        return res.status(400).json({
            error: "seconds must be a number"
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

// PERSIST
app.post("/persist/:key", (req, res) => {
    const success = cache.persist(req.params.key);

    res.json({
        success
    });
});

// Start server
app.listen(3000, () => {
    console.log("CacheX running on http://localhost:3000");
});


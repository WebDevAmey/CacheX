import express from "express";
import { CacheEngine } from "./cache.js";

const app = express();
const cache = new CacheEngine();

app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        name: "CacheX",
        status: "running"
    });
});

app.post("/set", (req, res) => {
    const { key, value } = req.body ?? {};

    if (typeof key !== "string" || key.length === 0 || value === undefined) {
        return res.status(400).json({
            error: "key must be a non-empty string and value is required"
        });
    }

    cache.set(key, value);

    res.json({
        message: "OK",
        key,
        value
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

app.use((_req, res) => {
    res.status(404).json({
        error: "Route not found"
    });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
        res.status(400).json({
            error: "Invalid JSON body"
        });
        return;
    }

    console.error("Unhandled error:", err);

    res.status(500).json({
        error: "Internal server error"
    });
});

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
    console.error(`Invalid PORT: ${process.env.PORT}`);
    process.exit(1);
}

const server = app.listen(PORT, HOST, () => {
    console.log(`CacheX running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
});

// Express 5 attaches its own `error` listener that swallows bind failures,
// which would let a port conflict kill the process with exit code 0.
server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Set PORT to a free port and try again.`);
    } else if (err.code === "EACCES") {
        console.error(`Permission denied binding port ${PORT}.`);
    } else {
        console.error("Server error:", err);
    }

    process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        console.log(`\nReceived ${signal}, shutting down.`);
        server.close(() => process.exit(0));
    });
}

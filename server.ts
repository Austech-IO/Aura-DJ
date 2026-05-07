import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import yts from "youtube-search-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Aura DJ Server is alive" });
  });

  // API Routes
  app.get("/api/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    try {
      console.log(`Searching YouTube for: ${query}`);
      const results = await yts.GetListByKeyword(query, false, 1);
      if (results && results.items && results.items.length > 0) {
        res.json(results.items[0]);
      } else {
        res.status(404).json({ error: "No results found" });
      }
    } catch (error) {
      console.error("YouTube search error:", error);
      res.status(500).json({ error: "Failed to search YouTube" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aura DJ Server running on http://localhost:${PORT}`);
  });
}

startServer();

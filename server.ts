import express from "express";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import yts from "youtube-search-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- YouTube Config ---
// YouTube search is kept on the backend

export async function createServer() {
  const app = express();

  app.use(express.json());

  // Spotify Auth Endpoints
  app.get("/api/auth/spotify/url", (req, res) => {
    const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
    const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const redirectUri = req.query.redirect_uri as string || `${baseUrl}/auth/callback`;
    
    if (!clientId) {
      return res.status(500).json({ error: "Spotify Client ID not configured" });
    }

    const scope = "user-read-private user-read-email user-library-read playlist-read-private streaming user-modify-playback-state user-read-playback-state";
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scope,
      show_dialog: "true"
    });

    res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  });

  app.get("/api/auth/spotify/callback", async (req, res) => {
    const { code, redirect_uri } = req.query;
    if (!code) {
      return res.status(400).send("Missing code");
    }

    try {
      const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: redirect_uri as string || `${baseUrl}/auth/callback`,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        return res.status(400).json(data);
      }

      // Return success HTML with the tokens and a closing script
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'SPOTIFY_AUTH_SUCCESS', 
                tokens: ${JSON.stringify(data)} 
              }, '*');
              window.close();
            </script>
            <p>Authentication successful. Window closing...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Spotify token exchange error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Aura DJ Server is alive" });
  });

  // YouTube API Routes
  app.get("/api/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    try {
      console.log(`[Aura DJ] 🔍 Searching YouTube: ${query}`);
      const results = await yts.GetListByKeyword(query, false, 5);
      if (results && results.items) {
        res.json(results.items);
      } else {
        res.status(404).json({ error: "No results found" });
      }
    } catch (error) {
      console.error("[Aura DJ] ❌ YouTube search error:", error);
      res.status(500).json({ error: "Failed to search YouTube" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (path.extname(req.path)) {
        res.status(404).end();
      } else {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  return app;
}

// Only start the server if this file is run directly (not through a function import like Vercel)
if (!process.env.VERCEL) {
  createServer().then(app => {
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT as number, "0.0.0.0", () => {
      console.log(`[Aura DJ] 🚀 Production server active on port ${PORT}`);
      console.log(`[Aura DJ] 🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Aura DJ] 🔑 GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Set' : 'Missing'}`);
      console.log(`[Aura DJ] 🎵 SPOTIFY_CLIENT_ID: ${process.env.VITE_SPOTIFY_CLIENT_ID ? 'Set' : 'Missing'}`);
      console.log(`[Aura DJ] 🔐 SPOTIFY_CLIENT_SECRET: ${process.env.SPOTIFY_CLIENT_SECRET ? 'Set' : 'Missing'}`);
    });

    // Handle process errors
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Aura DJ] ❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('[Aura DJ] ❌ Uncaught Exception:', error);
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('[Aura DJ] 🛑 Shutting down server...');
      server.close(() => {
        console.log('[Aura DJ] 🔌 Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}

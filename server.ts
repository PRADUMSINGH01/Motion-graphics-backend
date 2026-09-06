import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import routers from "./src/routes/routes.js";
import { getFirebaseStatus } from "./firebase/init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const server = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://frontend-khaki-kappa-22.vercel.app",
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in development for seamless developer experience
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true,
};


server.use(cors(corsOptions));
server.use(express.json());

server.get("/", (req, res) => {
  res.redirect(process.env.FRONTEND_URL || "");
});

server.get("/health", (req, res) => {
  const fbStatus = getFirebaseStatus();
  res.status(200).json({
    status: "OK",
    service: "Motion Graphics Backend",
    firebase: {
      ready: fbStatus.isReady,
      projectId: fbStatus.projectId || null,
      databaseConfigured: Boolean(fbStatus.databaseURL),
      source: fbStatus.initSource,
    },
  });
});

/*
Live preview hub for transactional emails
server.get("/preview-emails", (req, res) => {
  res.sendFile(path.join(__dirname, "src/emails/preview.html"));
});
*/

server.use("/api", routers);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
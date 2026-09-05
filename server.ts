import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = express();
const PORT = process.env.PORT || 3001;

// CORS configuration to allow requests from local dev and production frontend
server.use(
  cors({
      
    origin: true,
    credentials: true,
  })
);

server.use(express.json());

// Health check endpoint for Firebase App Hosting / Cloud Run
server.get("/", (req, res) => {
 res.redirect(process.env.FRONTEND_URL || "")
});

server.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Live preview hub for transactional emails
server.get("/preview-emails", (req, res) => {
  res.sendFile(path.join(__dirname, "src/emails/preview.html"));
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
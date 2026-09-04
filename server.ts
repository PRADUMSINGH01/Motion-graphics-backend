import express from "express";
import dotenv from "dotenv";

dotenv.config();

const server = express();
const PORT = process.env.PORT || 3001;

server.use(express.json());

// Health check endpoint for Firebase App Hosting / Cloud Run
server.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Motion Graphics Backend",
    timestamp: new Date().toISOString(),
  });
});

server.get("/health", (req, res) => {
  res.status(200).send("OK");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
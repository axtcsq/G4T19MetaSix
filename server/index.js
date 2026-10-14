import "dotenv/config";
import app from "./app.js";
import dns from "node:dns/promises";
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

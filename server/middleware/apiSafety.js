// Fetch Metadata also catches requests from untrusted sibling subdomains.
export function apiSafety(req, res, next) {
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("Origin");
    const allowed = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
      .split(",").map((value) => value.trim());
    const sameOrigin = `${req.protocol}://${req.get("host")}`;
    if (
      (origin && origin !== sameOrigin && !allowed.includes(origin)) ||
      (!origin && req.get("Sec-Fetch-Site") === "cross-site")
    ) {
      return res.status(403).json({ error: "Request origin is not allowed" });
    }
  }
  next();
}

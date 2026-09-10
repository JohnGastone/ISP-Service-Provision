/**
 * Stand-in for the Spring Boot API, matching the documented contract.
 * Useful for working on the UI without the real backend.
 *
 *   node mock/mock-spring.mjs                # 5 pools (default)
 *   POOL_COUNT=1 node mock/mock-spring.mjs   # 1 pool
 *   PORT=8081 node mock/mock-spring.mjs
 *
 * Then point the app at it:  SPRING_API_URL=http://localhost:8080 npm run dev
 *
 * Sign in as   admin / change-me            (ADMIN)
 *              ops@acme.co.tz / cust-pass-1 (CUSTOMER)
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT) || 8080;
const ADMIN = { user: "admin", pass: "change-me" };
const customerAccounts = { "ops@acme.co.tz": { password: "cust-pass-1", customerId: 1 } };

const customers = [
  { id: 1, name: "Acme Corp", email: "ops@acme.co.tz", phone: "+255712345678", district: "Kinondoni", region: "Dar es Salaam" },
  { id: 2, name: "Baraka Traders", email: "info@baraka.co.tz", phone: "+255654111222", district: "Moshi Municipal", region: "Kilimanjaro" },
];

// POOL_COUNT (1–5) varies how many pools the table renders.
const POOL_COUNT = Math.min(5, Math.max(1, Number(process.env.POOL_COUNT) || 5));
const poolSeeds = [
  { totalUploadMbps: 1000, totalDownloadMbps: 1000, uploadAllocatedMbps: 900, downloadAllocatedMbps: 900 },
  { totalUploadMbps: 110, totalDownloadMbps: 320, uploadAllocatedMbps: 0, downloadAllocatedMbps: 0 },
  { totalUploadMbps: 50, totalDownloadMbps: 50, uploadAllocatedMbps: 40, downloadAllocatedMbps: 45 },
  { totalUploadMbps: 2000, totalDownloadMbps: 5000, uploadAllocatedMbps: 1600, downloadAllocatedMbps: 2500 },
  { totalUploadMbps: 400, totalDownloadMbps: 400, uploadAllocatedMbps: 400, downloadAllocatedMbps: 400 },
];
const pools = poolSeeds.slice(0, POOL_COUNT).map((p, i) => ({ id: i + 1, ...p }));

const requests = [
  { id: 10, customerId: 1, poolId: 1, requestedUploadMbps: 50, requestedDownloadMbps: 80, status: "PENDING", requestedAt: "2026-09-01T08:00:00Z", decidedAt: null, decisionNote: null },
  { id: 11, customerId: 2, poolId: 1, requestedUploadMbps: 400, requestedDownloadMbps: 500, status: "PENDING", requestedAt: "2026-09-02T08:00:00Z", decidedAt: null, decisionNote: null },
];

const withRemaining = (p) => ({
  ...p,
  uploadRemainingMbps: p.totalUploadMbps - p.uploadAllocatedMbps,
  downloadRemainingMbps: p.totalDownloadMbps - p.downloadAllocatedMbps,
});

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const problem = (res, status, title, detail) =>
  send(res, status, { type: "about:blank", title, status, detail, timestamp: new Date().toISOString() });

createServer(async (req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  let body = "";
  for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : {};

  const auth = req.headers.authorization || "";
  let principal = null;
  if (auth.startsWith("Basic ")) {
    const [u, pw] = Buffer.from(auth.slice(6), "base64").toString().split(":");
    if (u === ADMIN.user && pw === ADMIN.pass) {
      principal = { username: u, admin: true, role: "ADMIN" };
    } else {
      const acc = customerAccounts[u];
      if (acc && acc.password === pw) {
        principal = { username: u, admin: false, role: "CUSTOMER", customerId: acc.customerId };
      }
    }
  }
  if (!principal) return problem(res, 401, "Unauthorized", "Full authentication is required");

  const isAdmin = principal.admin;
  const forbid = () => problem(res, 403, "Forbidden", "Admin role required");

  if (p === "/api/auth/login" || p === "/api/auth/me") return send(res, 200, principal);

  if (p === "/api/customers/me") {
    if (isAdmin) return forbid();
    return send(res, 200, customers.find((c) => c.id === principal.customerId));
  }
  if (p === "/api/bandwidth/requests/mine") {
    if (isAdmin) return forbid();
    return send(res, 200, requests.filter((r) => r.customerId === principal.customerId));
  }

  // Admin-only surfaces. Customers may READ pools, but not create them.
  if (!isAdmin && (
    p === "/api/customers" ||
    (p === "/api/bandwidth/pools" && req.method !== "GET") ||
    (p === "/api/bandwidth/requests" && req.method === "GET") ||
    /\/(approve|reject)$/.test(p)
  )) return forbid();

  if (p === "/api/customers" && req.method === "GET") return send(res, 200, customers);
  if (p === "/api/customers" && req.method === "POST") {
    if (customers.some((c) => c.email === json.email))
      return problem(res, 400, "Bad Request", `A customer with email ${json.email} already exists`);
    const c = { id: customers.length + 1, name: json.name, email: json.email, phone: json.phone, district: json.location?.district, region: json.location?.region };
    customers.push(c);
    const generatedPassword = "Tz-" + Math.random().toString(36).slice(2, 10);
    customerAccounts[c.email] = { password: generatedPassword, customerId: c.id };
    res.writeHead(201, { "Content-Type": "application/json", Location: `/api/customers/${c.id}` });
    return res.end(JSON.stringify({ ...c, generatedPassword }));
  }
  if (/^\/api\/customers\/\d+$/.test(p)) {
    const c = customers.find((x) => x.id === Number(p.split("/").pop()));
    return c ? send(res, 200, c) : problem(res, 404, "Not Found", "Customer not found");
  }

  if (p === "/api/bandwidth/pools" && req.method === "GET") return send(res, 200, pools.map(withRemaining));
  if (p === "/api/bandwidth/pools" && req.method === "POST") {
    const pool = { id: pools.length + 1, totalUploadMbps: json.totalUploadMbps, totalDownloadMbps: json.totalDownloadMbps, uploadAllocatedMbps: 0, downloadAllocatedMbps: 0 };
    pools.push(pool);
    return send(res, 201, withRemaining(pool));
  }
  if (/^\/api\/bandwidth\/pools\/\d+$/.test(p) && req.method === "PUT") {
    const pool = pools.find((x) => x.id === Number(p.split("/").pop()));
    if (!pool) return problem(res, 404, "Not Found", "Pool not found");
    if (json.totalUploadMbps < pool.uploadAllocatedMbps || json.totalDownloadMbps < pool.downloadAllocatedMbps)
      return problem(res, 422, "Unprocessable Entity", `New total is below allocated ${pool.uploadAllocatedMbps}/${pool.downloadAllocatedMbps} Mbps`);
    pool.totalUploadMbps = json.totalUploadMbps;
    pool.totalDownloadMbps = json.totalDownloadMbps;
    return send(res, 200, withRemaining(pool));
  }

  if (p === "/api/bandwidth/requests" && req.method === "GET") return send(res, 200, requests);
  if (p === "/api/bandwidth/requests" && req.method === "POST") {
    const customerId = isAdmin ? json.customerId : principal.customerId;
    if (!customers.some((c) => c.id === customerId)) return problem(res, 404, "Not Found", "Customer not found");
    if (!pools.some((x) => x.id === json.poolId)) return problem(res, 404, "Not Found", "Pool not found");
    const r = { id: 100 + requests.length, customerId, poolId: json.poolId, requestedUploadMbps: json.requestedUploadMbps, requestedDownloadMbps: json.requestedDownloadMbps, status: "PENDING", requestedAt: new Date().toISOString(), decidedAt: null, decisionNote: null };
    requests.push(r);
    return send(res, 201, r);
  }

  const m = p.match(/^\/api\/bandwidth\/requests\/(\d+)\/(approve|reject)$/);
  if (m) {
    const r = requests.find((x) => x.id === Number(m[1]));
    if (!r) return problem(res, 404, "Not Found", "Request not found");
    if (r.status !== "PENDING") return problem(res, 409, "Conflict", `Request ${r.id} is already ${r.status}`);
    const pool = pools.find((x) => x.id === r.poolId);
    if (m[2] === "approve") {
      const remU = pool.totalUploadMbps - pool.uploadAllocatedMbps;
      const remD = pool.totalDownloadMbps - pool.downloadAllocatedMbps;
      if (r.requestedUploadMbps > remU || r.requestedDownloadMbps > remD)
        return problem(res, 422, "Unprocessable Entity", `Pool ${pool.id} cannot cover request ${r.id}: needs ${r.requestedUploadMbps}/${r.requestedDownloadMbps} Mbps (up/down), remaining ${remU}/${remD} Mbps`);
      pool.uploadAllocatedMbps += r.requestedUploadMbps;
      pool.downloadAllocatedMbps += r.requestedDownloadMbps;
      r.status = "APPROVED";
    } else {
      if (!json.note) return problem(res, 400, "Bad Request", "note is required");
      r.status = "REJECTED";
    }
    r.decidedAt = new Date().toISOString();
    r.decisionNote = json.note ?? null;
    return send(res, 200, r);
  }

  problem(res, 404, "Not Found", `No mock route for ${req.method} ${p}`);
}).listen(PORT, () => console.log(`mock Spring API on :${PORT} with ${POOL_COUNT} pool(s)`));

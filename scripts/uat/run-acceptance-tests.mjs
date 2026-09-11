#!/usr/bin/env node
/**
 * G50.Golf — Acceptance UAT (spec §25, Phase 9)
 *
 * Runs the 3 required end-to-end scenarios against a LIVE api instance (real
 * Postgres, real transactions) rather than mocks — the platform's core
 * guarantees (capacity-safe booking, coach double-booking prevention,
 * cross-location account reuse) only mean something under a real database,
 * which is also how every prior phase in this build was verified.
 *
 * Usage: node scripts/uat/run-acceptance-tests.mjs
 * Requires: the dev stack running (`pnpm dev`), API reachable at API_URL.
 */

const API_URL = process.env.API_URL ?? "http://localhost:3333";
const RUN_ID = Date.now();

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    const line = detail ? `${label} — ${detail}` : label;
    failures.push(line);
    console.log(`  \x1b[31m✗\x1b[0m ${line}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function makeClient() {
  let cookie = null;
  async function call(method, path, body) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()[0]
        : res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON body (e.g. CSV) — caller reads res.text() itself if needed */
    }
    return { status: res.status, data };
  }
  return {
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b),
    patch: (p, b) => call("PATCH", p, b),
  };
}

async function login(email, password) {
  const client = makeClient();
  const res = await client.post("/auth/login", { email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return client;
}

async function registerGolfer(email) {
  const client = makeClient();
  const res = await client.post("/auth/register", {
    email,
    password: "uatpassword123",
    firstName: "UAT",
    lastName: "Golfer",
  });
  if (res.status !== 201) {
    throw new Error(`Register failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Scenario 1: HQ -> Location Admin -> Coach -> Golfer, through to
// attendance/payment/reporting.
// ---------------------------------------------------------------------------
async function scenario1(hq) {
  section("Scenario 1 — full booking loop through attendance/payment/reporting");

  const locSlug = `uat-loc-${RUN_ID}`;
  const locRes = await hq.post("/locations", {
    name: `UAT Location ${RUN_ID}`,
    slug: locSlug,
  });
  check("HQ creates a location", locRes.status === 201, JSON.stringify(locRes.data));
  const locationId = locRes.data?.id;

  const tplRes = await hq.post("/service-templates", {
    name: `UAT Class ${RUN_ID}`,
    type: "CLASS",
    defaultDurationMinutes: 60,
    defaultCapacity: 8,
    defaultPrice: 40,
  });
  check("HQ creates a service template", tplRes.status === 201, JSON.stringify(tplRes.data));
  const templateId = tplRes.data?.id;

  const locAdminEmail = `uat-locadmin-${RUN_ID}@test.com`;
  const staffRes = await hq.post("/staff", {
    email: locAdminEmail,
    firstName: "UAT",
    lastName: "LocationAdmin",
    password: "uatpassword123",
    locationId,
    role: "LOCATION_ADMIN",
  });
  check("HQ creates a Location Admin at the location", staffRes.status === 201, JSON.stringify(staffRes.data));

  const locAdmin = await login(locAdminEmail, "uatpassword123");

  const activateRes = await locAdmin.post(`/locations/${locationId}/services`, { templateId });
  check(
    "Location Admin activates the template as a Service",
    activateRes.status === 201,
    JSON.stringify(activateRes.data),
  );
  const serviceId = activateRes.data?.id;

  const coachEmail = `uat-coach-${RUN_ID}@test.com`;
  const coachStaffRes = await locAdmin.post("/staff", {
    email: coachEmail,
    firstName: "UAT",
    lastName: "Coach",
    password: "uatpassword123",
    locationId,
    role: "COACH",
  });
  check("Location Admin adds a Coach", coachStaffRes.status === 201, JSON.stringify(coachStaffRes.data));
  const coachId = coachStaffRes.data?.id;

  const startTime = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString();
  const sessionRes = await locAdmin.post(`/services/${serviceId}/sessions`, {
    coachId,
    startTime,
  });
  check("Location Admin schedules a session with the coach", sessionRes.status === 201, JSON.stringify(sessionRes.data));
  const sessionId = sessionRes.data?.id;

  const golferEmail = `uat-golfer1-${RUN_ID}@test.com`;
  const golfer = await registerGolfer(golferEmail);

  const bookingRes = await golfer.post(`/sessions/${sessionId}/bookings`, {
    paymentMethod: "FULL_PRICE",
  });
  check("Golfer books the session", bookingRes.status === 201, JSON.stringify(bookingRes.data));
  const bookingId = bookingRes.data?.id;

  // Payment is requested right after booking, while it's still CONFIRMED —
  // matches the real flow (pay at booking time), before attendance later
  // flips the booking to COMPLETED/NO_SHOW.
  const intentRes = await golfer.post(`/payments/bookings/${bookingId}/intent`, undefined);
  const intentPlumbingOk =
    intentRes.status === 201 ||
    (intentRes.status === 401 && /Invalid API Key/i.test(intentRes.data?.message ?? ""));
  check(
    "Payment intent endpoint responds correctly (clientSecret, or a clean Stripe auth error if no key is configured)",
    intentPlumbingOk,
    JSON.stringify(intentRes.data),
  );

  const coach = await login(coachEmail, "uatpassword123");
  const rosterRes = await coach.get(`/sessions/${sessionId}/roster`);
  check(
    "Coach sees the golfer on the roster",
    rosterRes.status === 200 && rosterRes.data?.some((r) => r.bookingId === bookingId),
    JSON.stringify(rosterRes.data),
  );

  const attendRes = await coach.post(`/bookings/${bookingId}/attendance`, { status: "ATTENDED" });
  check("Coach marks the golfer ATTENDED", attendRes.status === 201 || attendRes.status === 200, JSON.stringify(attendRes.data));

  const myBookingsRes = await golfer.get("/bookings/my");
  const updatedBooking = myBookingsRes.data?.find((b) => b.id === bookingId);
  check(
    "Booking status synced to COMPLETED after attendance",
    updatedBooking?.status === "COMPLETED",
    JSON.stringify(updatedBooking),
  );

  const reportRes = await locAdmin.get(`/reports/overview?locationId=${locationId}`);
  check(
    "Reporting shows the booking and attendance for this location",
    reportRes.status === 200 &&
      reportRes.data?.bookings?.total >= 1 &&
      reportRes.data?.attendance?.byStatus?.ATTENDED >= 1,
    JSON.stringify(reportRes.data),
  );

  return { locationId, serviceId, sessionId, coachId, coachEmail, golferEmail };
}

// ---------------------------------------------------------------------------
// Scenario 2: a full class accepts a waitlist entry, and a cancellation
// correctly promotes it.
// ---------------------------------------------------------------------------
async function scenario2(hq, ctx) {
  section("Scenario 2 — waitlist fills a cancelled spot");

  const startTime = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString();
  const sessionRes = await hq.post(`/services/${ctx.serviceId}/sessions`, {
    startTime,
    capacity: 1,
  });
  check("HQ creates a capacity-1 session", sessionRes.status === 201, JSON.stringify(sessionRes.data));
  const sessionId = sessionRes.data?.id;

  const golferAEmail = `uat-golferA-${RUN_ID}@test.com`;
  const golferA = await registerGolfer(golferAEmail);
  const bookARes = await golferA.post(`/sessions/${sessionId}/bookings`, { paymentMethod: "FULL_PRICE" });
  check("Golfer A books the only spot", bookARes.status === 201, JSON.stringify(bookARes.data));
  const bookingAId = bookARes.data?.id;

  const golferBEmail = `uat-golferB-${RUN_ID}@test.com`;
  const golferB = await registerGolfer(golferBEmail);
  const bookBRes = await golferB.post(`/sessions/${sessionId}/bookings`, { paymentMethod: "FULL_PRICE" });
  check(
    "Golfer B is rejected — session is full",
    bookBRes.status === 409 && /full/i.test(bookBRes.data?.message ?? ""),
    JSON.stringify(bookBRes.data),
  );

  const waitlistRes = await golferB.post(`/sessions/${sessionId}/waitlist`, undefined);
  check("Golfer B joins the waitlist", waitlistRes.status === 201, JSON.stringify(waitlistRes.data));
  const waitlistId = waitlistRes.data?.id;
  check("Golfer B is at waitlist position 1", waitlistRes.data?.position === 1, JSON.stringify(waitlistRes.data));

  const cancelRes = await golferA.post(`/bookings/${bookingAId}/cancel`, {});
  check("Golfer A cancels their booking", cancelRes.status === 201 || cancelRes.status === 200, JSON.stringify(cancelRes.data));

  const myWaitlistRes = await golferB.get("/waitlist/my");
  const entry = myWaitlistRes.data?.find((w) => w.id === waitlistId);
  check("Golfer B's waitlist entry flips to NOTIFIED", entry?.status === "NOTIFIED", JSON.stringify(entry));

  const claimRes = await golferB.post(`/waitlist/${waitlistId}/claim`, undefined);
  check("Golfer B claims the spot", claimRes.status === 201 || claimRes.status === 200, JSON.stringify(claimRes.data));

  const myBookingsRes = await golferB.get("/bookings/my");
  const claimedBooking = myBookingsRes.data?.find((b) => b.sessionId === sessionId);
  check(
    "Golfer B now has a CONFIRMED booking for the session",
    claimedBooking?.status === "CONFIRMED",
    JSON.stringify(claimedBooking),
  );
}

// ---------------------------------------------------------------------------
// Scenario 3: the same golfer and coach accounts operate correctly across two
// different locations, without duplication.
// ---------------------------------------------------------------------------
async function scenario3(hq, ctx) {
  section("Scenario 3 — same golfer/coach accounts across two locations");

  const loc2Slug = `uat-loc2-${RUN_ID}`;
  const loc2Res = await hq.post("/locations", {
    name: `UAT Location 2 ${RUN_ID}`,
    slug: loc2Slug,
  });
  check("HQ creates a second location", loc2Res.status === 201, JSON.stringify(loc2Res.data));
  const location2Id = loc2Res.data?.id;

  // Re-add the SAME coach (by email) at the second location — this is the
  // actual mechanism behind "one account, multiple locations" (Phase 2).
  const coachStaffRes = await hq.post("/staff", {
    email: ctx.coachEmail,
    locationId: location2Id,
    role: "COACH",
  });
  check(
    "The existing coach is added at location 2 (no new user created)",
    coachStaffRes.status === 201 && coachStaffRes.data?.id === ctx.coachId,
    JSON.stringify(coachStaffRes.data),
  );

  const coach = await login(ctx.coachEmail, "uatpassword123");
  const meRes = await coach.get("/auth/me");
  const locationRoles = meRes.data?.locations ?? [];
  const hasLoc1 = locationRoles.some((l) => l.locationId === ctx.locationId && l.role === "COACH");
  const hasLoc2 = locationRoles.some((l) => l.locationId === location2Id && l.role === "COACH");
  check(
    "The coach's single account shows COACH at both locations",
    hasLoc1 && hasLoc2,
    JSON.stringify(locationRoles),
  );

  // Coach double-booking prevention must hold across locations, not just
  // within one — an overlapping session at location 2 for the same coach at
  // the same time as an existing location-1 session should be rejected.
  const tplRes = await hq.post("/service-templates", {
    name: `UAT Class L2 ${RUN_ID}`,
    type: "CLASS",
    defaultDurationMinutes: 60,
    defaultCapacity: 8,
    defaultPrice: 40,
  });
  const activateRes = await hq.post(`/locations/${location2Id}/services`, { templateId: tplRes.data?.id });
  const service2Id = activateRes.data?.id;

  const overlappingStart = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString(); // same as scenario 1's session
  const overlapRes = await hq.post(`/services/${service2Id}/sessions`, {
    coachId: ctx.coachId,
    startTime: overlappingStart,
  });
  check(
    "An overlapping session for the same coach at location 2 is rejected (409)",
    overlapRes.status === 409,
    JSON.stringify(overlapRes.data),
  );

  // Same golfer books at location 2 — confirms cross-location account reuse
  // works for golfers too, not just coaches.
  const nonOverlappingStart = new Date(Date.now() + 4 * 24 * 60 * 60_000).toISOString();
  const session2Res = await hq.post(`/services/${service2Id}/sessions`, { startTime: nonOverlappingStart });
  const session2Id = session2Res.data?.id;

  const golfer = await login(ctx.golferEmail, "uatpassword123");
  const bookRes = await golfer.post(`/sessions/${session2Id}/bookings`, { paymentMethod: "FULL_PRICE" });
  check("The same golfer books a session at location 2", bookRes.status === 201, JSON.stringify(bookRes.data));

  const myBookingsRes = await golfer.get("/bookings/my");
  const locationIdsBooked = new Set(myBookingsRes.data?.map((b) => b.locationId));
  check(
    "The golfer's single account shows bookings at both locations",
    locationIdsBooked.has(ctx.locationId) && locationIdsBooked.has(location2Id),
    JSON.stringify([...locationIdsBooked]),
  );
}

async function main() {
  console.log(`G50.Golf acceptance UAT — run ${RUN_ID}, against ${API_URL}`);

  const hq = await login("hqadmin@g50.golf", "changeme123");

  const ctx = await scenario1(hq);
  await scenario2(hq, ctx);
  await scenario3(hq, ctx);

  console.log(`\n${"-".repeat(60)}`);
  console.log(`\x1b[1mResult: ${passed} passed, ${failed} failed\x1b[0m`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nUAT run crashed:", err);
  process.exit(1);
});

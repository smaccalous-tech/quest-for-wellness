# Firebase structure — Quest for Wellness

Firebase project: `quest-for-wellness-1a0f4`

| Service | Used for |
|---|---|
| **Authentication** (email/password) | Kelly's admin login and client portal logins |
| **Cloud Firestore** | Profiles, reports, appointments, messages, supplement requests |
| **Cloud Storage** | Original Qest4 PDFs (`reports/{reportId}/original.pdf`) |

Security rules live in [`firestore.rules`](firestore.rules) and [`storage.rules`](storage.rules).
Every rule requires a **verified email**. Kelly (`questforwellness22@gmail.com`) can read and write everything; clients only see their own records and only reports Kelly has published.

---

## One-time setup

1. **Authentication** → Sign-in method → enable **Email/Password**.
2. **Authentication** → Users → add Kelly's account first (`QuestforWellness22@gmail.com`), then one account per client.
3. **Authentication** → Settings → **User actions** → turn off **Enable create (sign-up)** so nobody can create their own account through the public API.
4. **Authentication** → Settings → Authorized domains → add `questforwellnessllc.com` and the Vercel domain.
5. **Firestore Database** → Create database (production mode, a US region) → **Rules** tab → paste `firestore.rules` → Publish.
6. **Storage** → Get started → **Rules** tab → paste `storage.rules` → Publish. (Cloud Storage needs the Blaze pay-as-you-go plan; usage at this scale is typically pennies.)
7. Each person (Kelly included) verifies their email the first time they sign in — the portal and admin panel walk them through it.

No Firestore indexes are needed: every query uses only equality filters and sorting happens in the browser.

---

## Collections

All timestamps are Firestore `Timestamp`s set with `serverTimestamp()` unless noted.
Emails are always stored **lowercase** — they link clients to their reports.

### `users/{uid}` — client profile
`uid` is the Firebase Auth user ID. Created automatically on the client's first portal sign-in.

| Field | Type | Written by | Notes |
|---|---|---|---|
| `name` | string | client | Editable in Profile |
| `email` | string | client | Kept in sync with the login email |
| `phone` | string | client | |
| `intakeSubmittedAt` | timestamp \| null | Kelly | Set on the admin Clients page |
| `createdAt`, `updatedAt` | timestamp | client | |

### `reports/{reportId}` — Qest4 scan reports

| Field | Type | Notes |
|---|---|---|
| `status` | `"draft"` \| `"published"` | Clients can only read `published` |
| `clientEmail` | string | **The link to the client.** Must match their login email |
| `clientId` | string \| null | Client's `uid` if they've signed in before; null for test clients |
| `clientName` | string | Display only |
| `analysisData` | map | Kelly-approved analysis — see shape below |
| `aiOriginal` | map | The AI's unedited output, kept for reference (admin-only) |
| `model` | string | Claude model that produced the draft |
| `originalPdfPath` | string \| null | Storage path, e.g. `reports/abc123/original.pdf` |
| `originalFileName` | string \| null | Uploaded file name |
| `scanDate` | string `YYYY-MM-DD` | Set by Kelly in the editor |
| `createdAt`, `updatedAt` | timestamp | |
| `approvedAt` | timestamp | Last time Kelly approved & published |
| `publishedAt` | timestamp | First publish |

`analysisData` shape (same as the AI response):

```json
{
  "wellnessScores": { "energy": 0, "digestive": 0, "immune": 0, "hormonal": 0, "stress": 0, "nutritional": 0 },
  "overallScore": 0,
  "summary": "…",
  "keyFindings": ["…"],
  "topSupplements": [{ "rank": 1, "name": "…", "brand": "Pure Encapsulations", "reason": "…", "priority": "High" }],
  "allRecommendations": ["…"],
  "lifestyleNotes": "…",
  "followUpRecommended": true,
  "disclaimer": "This report is for educational purposes only…"
}
```

Scores run 0–100 where **higher = more balanced**. Colors: green 70+, yellow 40–69, orange below 40.

### `appointments/{appointmentId}` — appointment requests

| Field | Type | Notes |
|---|---|---|
| `clientId`, `clientEmail`, `clientName` | string | Must match the signed-in client |
| `preferredDate` | string `YYYY-MM-DD` | |
| `preferredTime` | `"Morning"` \| `"Afternoon"` \| `"Evening"` | |
| `type` | `"New scan"` \| `"Follow-up"` \| `"Quick scan"` | |
| `notes` | string | |
| `status` | `"requested"` \| `"confirmed"` \| `"declined"` \| `"completed"` | Clients can only create `requested`; Kelly changes it |
| `createdAt`, `updatedAt` | timestamp | |

### `messages/{threadId}` — one thread per client
`threadId` is the client's `uid`.

| Field | Type | Notes |
|---|---|---|
| `clientId`, `clientEmail`, `clientName` | string | |
| `lastMessageAt` | timestamp | |
| `lastSender` | `"client"` \| `"admin"` | |
| `lastMessagePreview` | string | First 80 characters, for the admin thread list |
| `unreadByAdmin`, `unreadByClient` | boolean | Drive the unread badges |

#### `messages/{threadId}/messages/{messageId}`

| Field | Type | Notes |
|---|---|---|
| `sender` | `"client"` \| `"admin"` | Rules enforce that clients can only send as `client` |
| `text` | string | Up to 4,000 characters |
| `createdAt` | timestamp | |

### `supplementRequests/{requestId}` — supplement orders

| Field | Type | Notes |
|---|---|---|
| `clientId`, `clientEmail`, `clientName` | string | |
| `supplementName`, `brand` | string | Brand from the approved list |
| `quantity` | number | 1–12 |
| `notes` | string | |
| `reportId` | string \| null | Report the request came from |
| `status` | `"requested"` \| `"fulfilled"` | Kelly marks fulfilled on the dashboard |
| `createdAt`, `updatedAt` | timestamp | |

---

## Cloud Storage

`reports/{reportId}/original.pdf` — uploaded by Kelly when she first saves or publishes a report. Only Kelly can upload or delete. A client can download it only while the matching report is `published` and has their email.

---

## Test clients

The admin panel lists three test clients (`jane.test@…`, `sam.test@…`, `morgan.test@…` at questforwellnessllc.com) so the workflow can be tried before real clients sign in. To see a test report in the portal, create a Firebase Auth user with that email, then delete the user and its reports when finished.

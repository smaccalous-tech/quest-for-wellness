# HIPAA & privacy notes — Quest for Wellness

> This is a practical checklist, not legal advice. Whether HIPAA formally applies depends on how Quest for Wellness operates (for example, whether it bills insurance electronically). Even if it doesn't, the clients' wellness data deserves the same care, and many state privacy laws apply regardless. Confirm with a healthcare attorney or compliance advisor before storing real client data.

---

## What data is stored where

| Data | Where | Who can access it |
|---|---|---|
| Client name, email, phone | Firestore `users/{uid}` | The client; Kelly |
| Login credentials | Firebase Authentication (passwords are hashed by Google) | Nobody can read passwords |
| Qest4 analysis (scores, summary, findings, supplements) | Firestore `reports/{id}` | Kelly; the client once published |
| Original Qest4 PDF | Cloud Storage `reports/{id}/original.pdf` | Kelly; the client once published |
| Appointment requests | Firestore `appointments` | The client; Kelly |
| Messages | Firestore `messages/{uid}/messages` | The client; Kelly |
| Supplement requests | Firestore `supplementRequests` | The client; Kelly |
| Intake form answers | Emailed to Kelly via **EmailJS** (not stored in Firebase) | Kelly's Gmail inbox |
| Animal intake answers | Emailed to Kelly via EmailJS or the owner's email app | Kelly's Gmail inbox |

### Data sent to outside services

| Service | What it receives | Retained? |
|---|---|---|
| **Anthropic (Claude API)** | The Qest4 PDF only — **not** the client's name or email | Per Anthropic's API data policy; API data isn't used for training. Zero-retention and a BAA are available for eligible accounts |
| **Vercel** (hosts the site and `/api/analyze-report`) | The PDF passes through the function in memory | The function never logs or stores the PDF or name; only error types are logged |
| **EmailJS** | Notification emails and intake form content | Intake forms contain health history — see below |
| **Google Firebase** | Everything in the table above | Until deleted |

Notification emails sent by the portal and admin panel never include health details — only "you have something new, please sign in".

---

## Security rules in place

Published from [`firestore.rules`](firestore.rules) and [`storage.rules`](storage.rules):

- **Verified email required** for every read and write. This stops someone from creating an account with a client's email address and reading their reports.
- **Kelly only** (`questforwellness22@gmail.com`, verified) can create, edit, publish, or delete reports and PDFs, update appointment status, and see all clients.
- **Clients** can read only:
  - their own profile, appointments, supplement requests, and message thread (matched by user ID)
  - reports with `status == "published"` and `clientEmail` equal to their own login email
- Clients can't edit their intake date, approve their own appointments, or send messages as Kelly.
- Everything not listed is denied by default.
- `/api/analyze-report` checks Kelly's Firebase sign-in token on the server, so nobody else can run analyses (or spend the Anthropic API budget).

Also turn off public sign-up: Firebase → Authentication → Settings → User actions → uncheck **Enable create (sign-up)**. Kelly then creates every client account herself.

---

## BAA requirements for full HIPAA compliance

A **Business Associate Agreement (BAA)** is required with every vendor that creates, receives, stores, or transmits protected health information (PHI) on Kelly's behalf.

| Vendor | BAA available? | What to do |
|---|---|---|
| **Google Cloud / Firebase** | Yes — Google's Cloud BAA covers Firestore, Cloud Storage and Identity Platform (Firebase Authentication). Not every Firebase product is covered | Accept the BAA in the Google Cloud console (IAM & Admin → Settings / Compliance) for the `quest-for-wellness-1a0f4` project. Upgrade Firebase Authentication to **Identity Platform** if Google requires it for BAA coverage. Check Google's current list of covered services |
| **Anthropic** | Yes, for eligible API customers | Contact Anthropic sales to sign a BAA and enable **zero data retention** for the API key used here |
| **Vercel** | Only on Enterprise plans | The PDF passes through the function. Either get a Vercel BAA, or move the analysis function to a BAA-covered host (e.g. Google Cloud Functions under the Google BAA) |
| **EmailJS** | No | Don't send health information through EmailJS. Notification emails are already content-free; the **intake forms are not** — move them to a BAA-covered form tool or store submissions in Firestore |
| **Gmail** (Kelly's inbox) | Only with Google Workspace (paid) — free Gmail is not covered | Move to Google Workspace with a signed BAA, or stop receiving intake forms by email |

Without these BAAs, don't store or process real client health information in this system.

---

## Before storing real client data — Kelly's checklist

1. ☐ Get advice from a healthcare attorney or compliance consultant on whether HIPAA applies to the practice.
2. ☐ Sign BAAs with Google Cloud, Anthropic, and Vercel (or move the function), as listed above.
3. ☐ Enable zero data retention on the Anthropic API key.
4. ☐ Move intake forms off EmailJS and free Gmail.
5. ☐ In Firebase: enable Firestore and Storage, publish both rules files, turn off public sign-up, add authorized domains.
6. ☐ Verify Kelly's own email and turn on **multi-factor authentication** for her Google and Firebase console accounts.
7. ☐ Use a strong, unique password for the admin account and never share it.
8. ☐ Restrict the Firebase web API key in Google Cloud → APIs & Services → Credentials (allowed websites: `questforwellnessllc.com`, the Vercel domain).
9. ☐ Write a short privacy notice / Notice of Privacy Practices for clients and link it from the site footer (the footer links are currently placeholders).
10. ☐ Decide a retention policy (how long reports and messages are kept) and how clients can request deletion.
11. ☐ Get written client consent for AI-assisted report analysis.
12. ☐ Keep a simple log of who accessed what, and review Firebase → Authentication → Users regularly to remove old accounts.
13. ☐ Delete all test clients and test reports before going live.

---

## If something goes wrong

If a device with admin access is lost or a password may be compromised: change the admin password, sign out all sessions (Firebase console → Authentication → user → revoke), and review recent Firestore activity. A breach involving PHI may have notification obligations under HIPAA and state law — contact your advisor promptly.

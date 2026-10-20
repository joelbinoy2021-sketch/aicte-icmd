# AICTE ICMD — Integrated Complaint Management Dashboard

> **Cross-Bureau Coordination, Overlap Detection, and Single-Window Redressal for the All India Council for Technical Education (AICTE)**

---

## 🏛️ Executive Summary

AICTE receives thousands of complaints annually from students, faculty, whistleblowers, and citizen forums regarding engineering, management, pharmacy, and polytechnic institutions across India. Historically, these complaints reached different offices—primarily the **Regulation Bureau (RB)**, the **Public Grievance Redressal Cell (PGRC)**, and various **Regional Offices (ROs)**—operating in organizational silos without a shared data layer.

### The Problem
* **Duplicate Investigations:** RB and PGRC frequently initiate simultaneous inquiries into the same college without awareness of each other.
* **Conflicting Orders:** One bureau might issue interim relief while another initiates penalty proceedings or withdrawal of approval.
* **Accountability Deficits:** Inability to track which officer is handling which step or whether statutory 30-day Citizen Charter SLAs have lapsed.

### The Solution: ICMD
**ICMD** unifies all institutional grievances under a single authoritative dashboard, links complaints to each college's unique **AICTE Permanent ID**, and automatically triggers **"Potential Overlapping Cases – Coordination Required"** alerts when concurrent inquiries arise.

---

## ⚡ Key Innovations & Features

### 1. Overlap Detection Engine
* **Deterministic Match:** Instant 100% hard match on **AICTE Permanent ID** (e.g., `1-332456711`).
* **Fuzzy Institutional Match:** Employs **RapidFuzz** (`token_sort_ratio` & `partial_ratio`) to identify institutions even when registered with slight variations, abbreviated names, or incomplete address lines (e.g. *"Apex Inst. of Tech, Pune"* vs *"Apex Institute of Technology, Haveli, Pune"*).
* **Complaint Semantic / Lexical Similarity:** Scans complaint subject headlines and particulars for common grievance topics (e.g. *"withholding degree certificates"*, *"illegal capitation fee"*, *"unauthorized seat increase"*).
* **Human-in-the-Loop Confirmation:** Officers review side-by-side case comparisons and actively choose:
  1. **Link Cases for Joint Action:** Designate a **Lead Bureau** (e.g. RB investigates infrastructure while PGRC secures student relief) and record joint directives.
  2. **Dismiss as Distinct:** Enter justification notes stored in the permanent audit trail to prevent wrongful auto-merges.

### 2. Multi-Device Experience (Laptop & Mobile Phone)
* **On Laptop / Desktop:**
  * High-density case registry with sortable columns, live search, multi-condition filters (Bureau, Status, SLA, Overlap Flag).
  * Interactive Chart.js analytics: Bureau caseload donut, Grievance category breakdown, and Ageing profile.
  * Side-by-side comparative inspection for detected overlaps.
  * Official AICTE printable executive brief with print stylesheets.
* **On Mobile / Smartphone:**
  * Responsive touch header with tricolor ribbon and notification ticker.
  * Bottom navigation bar (Overview, Cases, Intake, Overlaps, Reports).
  * Card-based case view with touch-friendly status badges and quick action buttons.
  * Slide-up mobile drawers for timeline review and status recording.

### 3. Complete Step-by-Step Audit Trail
* Every action is timestamped and attributed with officer name, bureau, and remarks:
  * Case Registration & Intake
  * Automated Overlap Alert
  * Show Cause Notice Issuance
  * Institutional Reply & Verification
  * Escalation to Member Secretary
  * Final Case Disposal & Compliance Verification
* Clickable references to official documents and orders (e.g., `Show_Cause_Notice_0142.pdf`).

### 4. Real-time Overlap Pre-Check during Intake
* When an officer begins typing a college name or AICTE Permanent ID in the **Lodge Complaint** modal, ICMD queries the backend in real-time.
* If an active inquiry exists in another bureau, an immediate warning banner appears before the complaint is registered, fostering coordination from day one.

### 5. Role-Based Access Control (RBAC)
Quick role switcher in the header allows testing multiple perspectives:
* **Dr. Mamidala Jagadesh** — *Member Secretary (HQ)*: Master oversight across all bureaus and regions.
* **Dr. R. K. Sharma** — *Advisor, Regulation Bureau (RB)*: Approval compliance, intake quotas, infrastructure.
* **Prof. Ananya Sen** — *Director, Public Grievance Redressal Cell (PGRC)*: Student welfare, fee disputes, faculty salaries.
* **Er. M. Venkatesh** — *Regional Officer (RO)*: Ground verifications and physical inspections.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend** | HTML5, Tailwind CSS, FontAwesome 6, Chart.js | Modern, responsive, touch-friendly UI for phone and laptop |
| **Backend** | Python 3.14, FastAPI, Uvicorn | High-performance RESTful API endpoints |
| **Overlap AI** | RapidFuzz, Token Set Matching, Semantic Lexical Scorer | Intelligent deduplication and multi-attribute overlap scoring |
| **Database** | SQLite3 (PostgreSQL-ready schema) | Relational integrity, foreign keys, timeline audit logs |
| **Export Engine** | Python CSV Streaming, Print-to-PDF CSS | Executive reports and bulk case downloads |

---

## 🚀 Running the Project

### Prerequisites
* Python 3.10+
* Dependencies: `fastapi`, `uvicorn`, `rapidfuzz` (already installed in environment)

### Launch Server
```powershell
# From project directory
cd C:\Users\user\.gemini\antigravity\scratch\aicte-icmd
python run.py
```

Open your browser to:
* **Local Web Dashboard:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
* **Interactive API Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 📂 Project Directory Structure

```
aicte-icmd/
├── backend/
│   ├── database.py         # SQLite relational schema & realistic seed data
│   ├── main.py             # FastAPI REST endpoints & static file server
│   ├── models.py           # Pydantic validation schemas
│   └── overlap_detector.py # RapidFuzz and composite scoring engine
├── frontend/
│   ├── index.html          # Responsive single-page dashboard
│   ├── app.js              # State manager, real-time pre-check, charts & actions
│   └── styles.css          # Tailwind enhancements, print media queries & animations
├── run.py                  # Standalone execution script
└── README.md               # Architecture documentation
```

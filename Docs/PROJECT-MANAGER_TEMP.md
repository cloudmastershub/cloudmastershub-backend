# PROJECT-MANAGER\_TEMP.md

## 🧭 Project Management Template Overview

This is a **template** for generating the `PROJECT-MANAGER.md` file in a real project. It provides structure, placeholders, and instructions to guide the project manager or tech lead in populating it with actual data.

Use this file when starting a new project to coordinate ownership, track milestones, and maintain visibility across backend, frontend, DevOps, QA, and client-facing roles.

---

## 👤 Roles & Responsibilities (Example)

> Replace the names and descriptions with real team members and their contacts.

| Role            | Name  | Responsibility Description                         | Contact Info        |
| --------------- | ----- | -------------------------------------------------- | ------------------- |
| Project Manager | `TBD` | Coordinates project tasks, meetings, and deadlines | `email@example.com` |
| Tech Lead       | `TBD` | Oversees technical decisions and architecture      |                     |
| Backend Lead    | `TBD` | Manages backend development & API delivery         |                     |
| Frontend Lead   | `TBD` | Leads UI implementation and integration            |                     |
| DevOps Engineer | `TBD` | Handles deployments, CI/CD, infrastructure         |                     |
| QA Lead         | `TBD` | Manages test cases and release validation          |                     |
| Client Contact  | `TBD` | Reviews milestones, gives feedback                 |                     |

---

## 🧱 Microservices Status Tracker

> Populate this section using the microservices listed in `./PROJECT-INFO.md`. For each service, specify its development status and integration status.

| Service Name      | Description         | Dev Status | Integration Status |
| ----------------- | ------------------- | ---------- | ------------------ |
| `example-service` | Example description | ⏳ Planned  | ⏳ Pending          |
| ...               | ...                 | ...        | ...                |

> **Statuses:** ⏳ Planned, 🚧 In Progress, ✅ Ready, ✅ Integrated

---

## 📆 Milestones & Timeline

> Define major deliverables, their due dates, owners, and statuses.

| Milestone                | Description                                | Target Date | Owner(s)        | Status    |
| ------------------------ | ------------------------------------------ | ----------- | --------------- | --------- |
| Requirements Finalized   | Functional & technical requirements agreed | YYYY-MM-DD  | Project Manager | ⏳ Planned |
| Infrastructure Setup     | Helm charts, DB, secrets configured        | YYYY-MM-DD  | DevOps          | ⏳ Planned |
| MVP Development Complete | Core services implemented                  | YYYY-MM-DD  | Backend Team    | ⏳ Planned |
| Frontend Integration     | APIs connected to UI                       | YYYY-MM-DD  | Frontend Team   | ⏳ Planned |
| Testing & QA             | End-to-end testing completed               | YYYY-MM-DD  | QA Lead         | ⏳ Planned |
| Client Review & Feedback | Internal UAT and client feedback           | YYYY-MM-DD  | Client Contact  | ⏳ Planned |
| Go-Live                  | Project released to production             | YYYY-MM-DD  | All             | ⏳ Planned |

---

## 🧰 Key Resources

> Replace URLs with project-specific links.

* **Docs Repository**: `https://github.com/org/project-docs`
* **Backend Repo**: `https://github.com/org/project-backend`
* **Frontend Repo**: `https://github.com/org/project-frontend`
* **CI/CD Dashboard**: `http://ci.internal/project`
* **Figma UI Design**: `https://figma.com/file/project-design`

---

## 💬 Team Communication

> Use this to define communication routines.

* **Daily Standups**: 15 min, Mon–Fri @ 9 AM
* **Weekly Syncs**: 30–60 min review + sprint planning
* **Issue Tracking Tool**: Jira, GitHub Projects, or Notion
* **Decision Logs**: Maintain critical decisions in `/docs/DECISIONS.md`

---

## 🚦 Risk Management

| Risk                            | Impact | Mitigation Strategy                      |
| ------------------------------- | ------ | ---------------------------------------- |
| Requirements Creep              | High   | Lock scope before sprint planning        |
| Delayed API Integration         | Medium | Mock APIs early + align backend/frontend |
| Production Downtime Post-GoLive | High   | Use rollback plan + pre-deployment QA    |

---

## 📌 Notes & Reminders

* This is a **template**. Replace placeholders with actual project content.
* Keep this document version-controlled and updated as the project progresses.
* Reference `PROJECT-INFO.md` for service and architecture alignment.

This template enables any team to generate a complete `PROJECT-MANAGER.md` file tailored to their project's actual data and needs.


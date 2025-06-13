# GENERAL-PROJECT-INFO.md

## 📌 Overview

This document serves as a comprehensive template for capturing key project information across any microservices-based platform. It ensures that all stakeholders—backend, frontend, DevOps, QA, and business—have a unified reference point.

Use this file in each project to define the architecture, responsibilities, and integration strategy across teams.

---

## 🧾 Project Description

> Provide a brief but clear description of the project's purpose, audience, and core objectives.

Example:

> `SmartAgroPlatform` is an AI-driven farm management system that helps new and experienced farmers plan, monitor, and optimize their agricultural operations.

---

## 🧩 Core Features / Modules

List the major features or modules the platform provides. For example:

* User authentication and onboarding
* Farm setup advisor
* Weather and soil data integration
* Inventory and resource management
* Market price insights
* Alerts and notifications

---

## 🔧 Microservices List

| Service Name         | Description                               | Status     |
| -------------------- | ----------------------------------------- | ---------- |
| auth-service         | Manages user login, registration, JWT     | ✅ Done     |
| farm-service         | Handles farm entities and ownership       | 🚧 WIP     |
| schedule-service     | Manages planting/harvesting schedules     | 🧠 Planned |
| notification-service | Delivers email/SMS/push notifications     | ✅ Done     |
| analytics-service    | Provides performance metrics and insights | 🧠 Planned |

---

## 🌐 Microservices Endpoints

| Service              | Endpoint                     | Method | Purpose            |
| -------------------- | ---------------------------- | ------ | ------------------ |
| auth-service         | `/api/v1/auth/login`         | POST   | Login              |
| auth-service         | `/api/v1/auth/register`      | POST   | Register new users |
| farm-service         | `/api/v1/farms`              | GET    | List all farms     |
| notification-service | `/api/v1/notifications/send` | POST   | Send notification  |

> Expand as new services and routes are implemented.

---

## 🗃️ Project Repositories

| Repo Name                      | Purpose                 | URL                                    |
| ------------------------------ | ----------------------- | -------------------------------------- |
| smartagro-auth-service         | Authentication backend  | `https://github.com/org/auth-service`  |
| smartagro-farm-service         | Farm management service | `https://github.com/org/farm-service`  |
| smartagro-notification-service | Notification handling   | `https://github.com/org/notif-service` |

---

## ☁️ Infrastructure & DevOps

| Component         | Description                       | Status     |
| ----------------- | --------------------------------- | ---------- |
| CI/CD Pipeline    | Jenkins pipeline for all services | ✅ Done     |
| Containerization  | Dockerized each service           | ✅ Done     |
| Orchestration     | Helm chart for each microservice  | 🚧 WIP     |
| Monitoring        | Prometheus + Grafana              | 🧠 Planned |
| Secret Management | Handled using Kubernetes Secrets  | ✅ Done     |

---

## 👥 Team Collaboration & Notes

* Backend team should notify frontend when new endpoints are available.
* Use Swagger docs (`/api-docs`) to view each service’s API spec.
* Define integration contracts before connecting services.
* Maintain changelogs in each repo.

---

## 📁 Key Project Files

* `PROJECT-INFO.md`: Core project details for cross-team reference.
* `PROJECT-MANAGER.md`: Tracks team roles, owners, and timelines.
* `README.md`: Dev-focused quickstart and context.
* `infra/helm/`: Kubernetes deployment configs.
* `.env.example`: Sample environment variables.

---

## ✅ Summary: What You Should Do

| Task         | Recommendation                                         |
| ------------ | ------------------------------------------------------ |
| Architecture | Use microservices; isolate concerns                    |
| Docs         | Keep this file updated as services evolve              |
| Sharing      | Share across frontend/backend/DevOps teams             |
| Maintenance  | Use changelogs, Git branches, and semver               |
| Automation   | Integrate builds & deploys into Jenkins/GitHub Actions |

This living document will ensure the  project is well-documented, scalable, and easy to onboard new contributors.


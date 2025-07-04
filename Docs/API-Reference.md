# CloudMastersHub API Reference

## Overview

CloudMastersHub provides a comprehensive RESTful API for managing cloud learning content, user authentication, subscriptions, and interactive labs. The API follows microservices architecture with a centralized API Gateway.

### Base URL
- **Production**: `https://api.cloudmastershub.com`
- **Development**: `http://localhost:3000`

### API Gateway Routes
All API requests go through the API Gateway at `/api/*` which routes to appropriate microservices:

- **Authentication & Users**: `/api/auth/*`, `/api/users/*` → User Service (Port 3001)
- **Courses & Learning Paths**: `/api/courses/*`, `/api/paths/*` → Course Service (Port 3002)
- **Labs & Sessions**: `/api/labs/*` → Lab Service (Port 3003)
- **Payments & Subscriptions**: `/api/payments/*`, `/api/subscriptions/*`, `/api/purchases/*` → Payment Service (Port 3004)
- **Webhooks**: `/api/webhooks/*` → Payment Service (Port 3004)
- **Admin**: `/api/admin/*` → Admin Service (Port 3005)

## Authentication

### JWT Token Authentication
Most endpoints require authentication using JWT tokens in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Token Refresh
Access tokens expire after 15 minutes. Use refresh tokens to obtain new access tokens.

## Standard Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "total": 100 },
  "meta": { "version": "v1", "timestamp": "2025-07-04T12:00:00Z" }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }
  }
}
```

## Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Configurable per service
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Authentication Endpoints

### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    }
  }
}
```

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "subscription": {
        "plan": "free",
        "status": "active"
      }
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    }
  }
}
```

### Google OAuth
```http
POST /api/auth/google
```

**Request Body:**
```json
{
  "googleToken": "google_oauth_token",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "avatar": "https://example.com/avatar.jpg"
}
```

### Refresh Token
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

### Logout
```http
POST /api/auth/logout
```
*Requires Authentication*

---

## User Management Endpoints

### Get User Profile
```http
GET /api/users/profile
```
*Requires Authentication*

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student",
    "subscription": {
      "plan": "individual",
      "status": "active",
      "expiresAt": "2025-08-04T12:00:00Z"
    },
    "profile": {
      "avatar": "https://example.com/avatar.jpg",
      "bio": "Cloud enthusiast",
      "completedCourses": 5,
      "totalProgress": 75
    }
  }
}
```

### Update User Profile
```http
PUT /api/users/profile
```
*Requires Authentication*

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Updated bio",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

### Get User Progress
```http
GET /api/users/progress
```
*Requires Authentication*

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCourses": 10,
    "completedCourses": 3,
    "inProgressCourses": 2,
    "totalLessons": 150,
    "completedLessons": 45,
    "averageProgress": 30,
    "streakDays": 7,
    "totalStudyTime": 3600
  }
}
```

---

## Course Management Endpoints

### Get All Courses
```http
GET /api/courses
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)
- `provider` (optional): Filter by cloud provider (aws, azure, gcp)
- `level` (optional): Filter by difficulty level (beginner, intermediate, advanced)
- `category` (optional): Filter by category
- `search` (optional): Search term

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "course_id",
      "title": "AWS Cloud Practitioner Essentials",
      "description": "Comprehensive introduction to AWS cloud services",
      "provider": "aws",
      "level": "beginner",
      "category": "cloud-fundamentals",
      "thumbnail": "https://example.com/thumbnail.jpg",
      "duration": 1200,
      "lessonsCount": 15,
      "rating": 4.8,
      "studentsCount": 1250,
      "price": 49.99,
      "isPremium": false,
      "instructor": {
        "id": "instructor_id",
        "name": "John Smith",
        "avatar": "https://example.com/instructor.jpg"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Get Course by ID
```http
GET /api/courses/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "course_id",
    "title": "AWS Cloud Practitioner Essentials",
    "description": "Comprehensive introduction to AWS cloud services",
    "provider": "aws",
    "level": "beginner",
    "category": "cloud-fundamentals",
    "thumbnail": "https://example.com/thumbnail.jpg",
    "duration": 1200,
    "lessonsCount": 15,
    "rating": 4.8,
    "studentsCount": 1250,
    "price": 49.99,
    "isPremium": false,
    "curriculum": [
      {
        "id": "lesson_id",
        "title": "Introduction to AWS",
        "duration": 300,
        "type": "video",
        "isPreview": true
      }
    ],
    "instructor": {
      "id": "instructor_id",
      "name": "John Smith",
      "avatar": "https://example.com/instructor.jpg",
      "bio": "AWS certified expert"
    },
    "requirements": ["Basic computer knowledge"],
    "whatYouWillLearn": ["AWS core services", "Cloud computing fundamentals"]
  }
}
```

### Create Course
```http
POST /api/courses
```
*Requires Authentication & Premium Subscription*

**Request Body:**
```json
{
  "title": "Azure Fundamentals",
  "description": "Learn Azure cloud services",
  "provider": "azure",
  "level": "beginner",
  "category": "cloud-fundamentals",
  "price": 59.99,
  "isPremium": true,
  "curriculum": [
    {
      "title": "Introduction to Azure",
      "duration": 300,
      "type": "video"
    }
  ]
}
```

### Update Course
```http
PUT /api/courses/:id
```
*Requires Authentication & Course Ownership*

### Delete Course
```http
DELETE /api/courses/:id
```
*Requires Authentication & Admin Role*

### Enroll in Course
```http
POST /api/courses/:id/enroll
```
*Requires Authentication*

**Response:**
```json
{
  "success": true,
  "data": {
    "enrollmentId": "enrollment_id",
    "courseId": "course_id",
    "userId": "user_id",
    "enrolledAt": "2025-07-04T12:00:00Z",
    "progress": {
      "completedLessons": 0,
      "totalLessons": 15,
      "percentage": 0
    }
  }
}
```

### Access Course Content
```http
GET /api/courses/:id/content
```
*Requires Authentication & Course Access*

---

## Lab Management Endpoints

### Get All Labs
```http
GET /api/labs
```

**Query Parameters:**
- `page`, `limit`, `provider`, `level`, `search` (same as courses)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lab_id",
      "title": "AWS EC2 Hands-on Lab",
      "description": "Practice creating and managing EC2 instances",
      "provider": "aws",
      "level": "intermediate",
      "duration": 1800,
      "difficulty": "intermediate",
      "resources": ["t2.micro", "security-groups"],
      "isPremium": true,
      "estimatedCost": 0.50
    }
  ]
}
```

### Get Lab by ID
```http
GET /api/labs/:id
```

### Get Labs by Course
```http
GET /api/labs/course/:courseId
```

### Create Lab
```http
POST /api/labs
```
*Requires Authentication & Premium Subscription*

### Access Lab Environment
```http
GET /api/labs/:id/access
```
*Requires Authentication & Lab Access*

**Response:**
```json
{
  "success": true,
  "data": {
    "labId": "lab_id",
    "accessLevel": "premium",
    "environmentUrl": "https://lab.cloudmastershub.com/env/session_id",
    "credentials": {
      "username": "student_123",
      "password": "temp_password"
    },
    "expiresAt": "2025-07-04T16:00:00Z"
  }
}
```

---

## Payment & Subscription Endpoints

### Get Subscription Plans
```http
GET /api/subscriptions/plans
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "interval": "month",
      "features": ["Limited course access", "Community forums"],
      "limits": {
        "coursesPerMonth": 3,
        "labHours": 0
      }
    },
    {
      "id": "individual",
      "name": "Individual",
      "price": 29.99,
      "interval": "month",
      "features": ["Unlimited course access", "Lab environments", "Certificates"],
      "limits": {
        "coursesPerMonth": -1,
        "labHours": 20
      }
    },
    {
      "id": "professional",
      "name": "Professional",
      "price": 79.99,
      "interval": "month",
      "features": ["Everything in Individual", "Priority support", "Advanced labs"],
      "limits": {
        "coursesPerMonth": -1,
        "labHours": 50
      }
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "price": 199.99,
      "interval": "month",
      "features": ["Everything in Professional", "Team management", "Custom content"],
      "limits": {
        "coursesPerMonth": -1,
        "labHours": -1
      }
    }
  ]
}
```

### Get Subscription Status
```http
GET /api/subscriptions/status/:userId
```
*Requires Authentication*

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "subscription_id",
    "userId": "user_id",
    "plan": "individual",
    "status": "active",
    "currentPeriodStart": "2025-07-04T12:00:00Z",
    "currentPeriodEnd": "2025-08-04T12:00:00Z",
    "cancelAtPeriodEnd": false,
    "usage": {
      "coursesThisMonth": 8,
      "labHoursUsed": 12.5
    }
  }
}
```

### Create Checkout Session
```http
POST /api/subscriptions/checkout-session
```
*Requires Authentication*

**Request Body:**
```json
{
  "planId": "individual",
  "successUrl": "https://cloudmastershub.com/success",
  "cancelUrl": "https://cloudmastershub.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_session_id",
    "url": "https://checkout.stripe.com/pay/cs_session_id"
  }
}
```

### Cancel Subscription
```http
POST /api/subscriptions/:subscriptionId/cancel
```
*Requires Authentication*

### Get Payment History
```http
GET /api/payments/history/:userId
```
*Requires Authentication*

### Get Payment Methods
```http
GET /api/payments/methods/:userId
```
*Requires Authentication*

### Add Payment Method
```http
POST /api/payments/methods
```
*Requires Authentication*

---

## Admin Endpoints

### Get Users (Admin)
```http
GET /api/admin/users
```
*Requires Admin Authentication*

**Query Parameters:**
- `page`, `limit`, `search`, `role`, `status`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "status": "active",
      "subscription": {
        "plan": "individual",
        "status": "active"
      },
      "createdAt": "2025-01-01T12:00:00Z",
      "lastLoginAt": "2025-07-04T11:00:00Z"
    }
  ]
}
```

### Get User Statistics
```http
GET /api/admin/users/stats
```
*Requires Admin Authentication*

### Manage User Status
```http
PUT /api/admin/users/:userId/status
```
*Requires Admin Authentication*

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Terms of service violation"
}
```

### Get Instructor Applications
```http
GET /api/admin/users/instructors/applications
```
*Requires Admin Authentication*

### Review Instructor Application
```http
PUT /api/admin/users/instructors/applications/:applicationId
```
*Requires Admin Authentication*

---

## Webhook Endpoints

### Stripe Webhook
```http
POST /api/webhooks/stripe
```
*Stripe Signature Required*

Handles Stripe events for subscription updates, payment confirmations, and cancellations.

---

## Error Codes

### Authentication Errors
- `AUTH_TOKEN_MISSING`: No authentication token provided
- `AUTH_TOKEN_INVALID`: Invalid or expired token
- `AUTH_TOKEN_EXPIRED`: Token has expired
- `AUTH_INSUFFICIENT_PERMISSIONS`: User lacks required permissions

### Validation Errors
- `VALIDATION_ERROR`: Request validation failed
- `INVALID_EMAIL`: Invalid email format
- `PASSWORD_TOO_SHORT`: Password doesn't meet requirements
- `REQUIRED_FIELD_MISSING`: Required field not provided

### Resource Errors
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RESOURCE_ALREADY_EXISTS`: Resource already exists
- `COURSE_NOT_ACCESSIBLE`: Course requires higher subscription
- `LAB_NOT_ACCESSIBLE`: Lab requires premium subscription

### Subscription Errors
- `SUBSCRIPTION_REQUIRED`: Action requires active subscription
- `SUBSCRIPTION_EXPIRED`: Subscription has expired
- `PAYMENT_REQUIRED`: Payment required to continue
- `USAGE_LIMIT_EXCEEDED`: Monthly usage limit exceeded

### System Errors
- `INTERNAL_SERVER_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `RATE_LIMIT_EXCEEDED`: Too many requests

---

## Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `502 Bad Gateway`: Service unavailable
- `503 Service Unavailable`: Service temporarily unavailable

---

## Development & Testing

### Health Check
```http
GET /health
```
Available on all services for monitoring.

### Service-Specific Health Checks
- API Gateway: `http://localhost:3000/health`
- User Service: `http://localhost:3001/health`
- Course Service: `http://localhost:3002/health`
- Lab Service: `http://localhost:3003/health`
- Payment Service: `http://localhost:3004/health`
- Admin Service: `http://localhost:3005/health`

### Database Connections
- PostgreSQL: User, Payment, Admin services
- MongoDB: Course service
- Redis: All services (caching, sessions, queues)

---

## SDKs and Libraries

### JavaScript/TypeScript SDK
```javascript
import { CloudMastersHubAPI } from '@cloudmastershub/sdk';

const api = new CloudMastersHubAPI({
  baseURL: 'https://api.cloudmastershub.com',
  apiKey: 'your-api-key'
});

// Get courses
const courses = await api.courses.getAll();

// Enroll in course
await api.courses.enroll(courseId);
```

### Shared TypeScript Types
Available in `@cloudmastershub/types` package for consistent type definitions across services.

---

## Version Information

- **API Version**: v1
- **Last Updated**: July 2025
- **Documentation Version**: 1.0.0
- **OpenAPI Specification**: Available at `/api/docs` (when implemented)

---

## Support

For API support and questions:
- **Documentation**: https://docs.cloudmastershub.com
- **Support Email**: api-support@cloudmastershub.com
- **GitHub Issues**: https://github.com/cloudmastershub/api/issues
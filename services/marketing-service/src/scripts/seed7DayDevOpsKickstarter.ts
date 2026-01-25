import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub';

// Import models after mongoose setup
import { Challenge, ChallengeStatus } from '../models/Challenge';
import { Funnel, FunnelStatus, FunnelType, DeliveryMode, FunnelStepType, StepBlockType } from '../models/Funnel';
import { EmailTemplate, EmailTemplateCategory, EmailTemplateStatus } from '../models/EmailTemplate';
import { EmailSequence, EmailSequenceStatus, SequenceTrigger, SendTimeOption } from '../models/EmailSequence';

// ============================================
// EMAIL TEMPLATES
// ============================================

const emailTemplates = [
  {
    name: '7-Day DevOps Kickstarter - Welcome',
    slug: 'devops-kickstarter-welcome',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '🚀 Welcome to the 7-Day DevOps Kickstarter - Day 1 Starts NOW!',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #10b981; margin: 0;">🚀 Welcome to the 7-Day DevOps Kickstarter!</h1>
  </div>

  <p>Hey {{firstName}},</p>

  <p>You just made one of the best decisions for your career. Welcome to the <strong>7-Day DevOps Kickstarter</strong>!</p>

  <p>Over the next 7 days, you're going to:</p>
  <ul>
    <li>✅ Get crystal clear on what DevOps actually is (and isn't)</li>
    <li>✅ Master the essential tools used in production environments</li>
    <li>✅ Build real CI/CD pipelines from scratch</li>
    <li>✅ Containerize applications with Docker</li>
    <li>✅ Deploy to Kubernetes like a pro</li>
    <li>✅ Create a portfolio project you can show employers</li>
  </ul>

  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
    <h2 style="color: white; margin: 0 0 15px 0;">🎯 Day 1: DevOps Clarity & Career Roadmap</h2>
    <p style="color: rgba(255,255,255,0.9); margin-bottom: 20px;">Your journey starts now. Click below to access today's content.</p>
    <a href="{{challengeUrl}}" style="display: inline-block; background: white; color: #059669; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">START DAY 1 →</a>
  </div>

  <p><strong>Pro Tip:</strong> Set aside 30-45 minutes each day for the best results. Consistency beats intensity!</p>

  <p>Let's do this! 💪</p>

  <p>— The CloudMastersHub Team</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #666; font-size: 12px;">
    You're receiving this because you signed up for the 7-Day DevOps Kickstarter at CloudMastersHub.<br>
    <a href="{{unsubscribeUrl}}" style="color: #666;">Unsubscribe</a>
  </p>
</body>
</html>`,
    textContent: `Welcome to the 7-Day DevOps Kickstarter!

Hey {{firstName}},

You just made one of the best decisions for your career.

Over the next 7 days, you're going to:
- Get crystal clear on what DevOps actually is
- Master essential tools used in production
- Build real CI/CD pipelines
- Containerize applications with Docker
- Deploy to Kubernetes like a pro
- Create a portfolio project

DAY 1: DevOps Clarity & Career Roadmap
Start now: {{challengeUrl}}

Pro Tip: Set aside 30-45 minutes each day for best results.

Let's do this!
— The CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'challengeUrl', description: 'Link to challenge page', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Day 2',
    slug: 'devops-kickstarter-day-2',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '⚙️ Day 2: Linux & Command Line Mastery - Your Foundation',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">⚙️ Day 2 is LIVE!</h1>
  <p>Hey {{firstName}},</p>
  <p>Great job completing Day 1! Today we're diving into the foundation of every DevOps engineer's toolkit:</p>
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #059669;">Day 2: Linux & Command Line Mastery</h2>
    <p style="margin: 0;">Learn the essential Linux commands and shell skills that you'll use every single day as a DevOps engineer.</p>
  </div>
  <p><strong>Today you'll learn:</strong></p>
  <ul>
    <li>🖥️ Essential Linux commands for DevOps</li>
    <li>📁 File system navigation & permissions</li>
    <li>🔧 Shell scripting fundamentals</li>
    <li>🔑 SSH & remote server management</li>
  </ul>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{dayUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold;">ACCESS DAY 2 →</a>
  </div>
  <p>See you inside!</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `Day 2 is LIVE! Linux & Command Line Mastery

Hey {{firstName}},

Great job completing Day 1! Today we're diving into the foundation:

DAY 2: Linux & Command Line Mastery

Today you'll learn:
- Essential Linux commands for DevOps
- File system navigation & permissions
- Shell scripting fundamentals
- SSH & remote server management

Access Day 2: {{dayUrl}}

See you inside!
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'dayUrl', description: 'Link to day content', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Day 3',
    slug: 'devops-kickstarter-day-3',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '🔄 Day 3: Git & Version Control - Collaboration Unlocked',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">🔄 Day 3 is Ready!</h1>
  <p>Hey {{firstName}},</p>
  <p>You're building serious momentum! Day 3 is where things get really exciting:</p>
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #059669;">Day 3: Git & Version Control</h2>
    <p style="margin: 0;">Master the tool that every development team uses for collaboration and code management.</p>
  </div>
  <p><strong>Today's agenda:</strong></p>
  <ul>
    <li>🌿 Git branching strategies (GitFlow, trunk-based)</li>
    <li>🔀 Merge conflicts & resolution</li>
    <li>🏷️ Tags, releases, and semantic versioning</li>
    <li>🤝 Pull request workflows</li>
  </ul>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{dayUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold;">ACCESS DAY 3 →</a>
  </div>
  <p>Keep crushing it!</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `Day 3 is Ready! Git & Version Control

Hey {{firstName}},

You're building momentum! Day 3:

DAY 3: Git & Version Control

Today's agenda:
- Git branching strategies
- Merge conflicts & resolution
- Tags, releases, and versioning
- Pull request workflows

Access Day 3: {{dayUrl}}

Keep crushing it!
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'dayUrl', description: 'Link to day content', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Day 4',
    slug: 'devops-kickstarter-day-4',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '🐳 Day 4: Docker Fundamentals - Containerize Everything',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">🐳 Day 4: Docker Time!</h1>
  <p>Hey {{firstName}},</p>
  <p>This is the day many people have been waiting for! Docker is a game-changer:</p>
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #059669;">Day 4: Docker Fundamentals</h2>
    <p style="margin: 0;">Learn to containerize applications and say goodbye to "it works on my machine" forever.</p>
  </div>
  <p><strong>What you'll master:</strong></p>
  <ul>
    <li>📦 Docker architecture & concepts</li>
    <li>📝 Writing production-ready Dockerfiles</li>
    <li>🔗 Docker Compose for multi-container apps</li>
    <li>🏗️ Building & pushing images</li>
  </ul>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{dayUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold;">ACCESS DAY 4 →</a>
  </div>
  <p>🔥 You're halfway through! Keep going!</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `Day 4: Docker Time!

Hey {{firstName}},

This is the day many have been waiting for!

DAY 4: Docker Fundamentals

What you'll master:
- Docker architecture & concepts
- Writing production-ready Dockerfiles
- Docker Compose for multi-container apps
- Building & pushing images

Access Day 4: {{dayUrl}}

You're halfway through! Keep going!
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'dayUrl', description: 'Link to day content', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Day 5',
    slug: 'devops-kickstarter-day-5',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '🔧 Day 5: CI/CD Pipelines - Automate Your Deployments',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">🔧 Day 5: CI/CD Pipelines!</h1>
  <p>Hey {{firstName}},</p>
  <p>Today is where everything starts coming together. CI/CD is the heart of DevOps:</p>
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #059669;">Day 5: CI/CD Pipelines</h2>
    <p style="margin: 0;">Build automated pipelines that test, build, and deploy your code automatically.</p>
  </div>
  <p><strong>Pipeline mastery:</strong></p>
  <ul>
    <li>⚡ CI/CD concepts & best practices</li>
    <li>🔨 GitHub Actions / Jenkins pipelines</li>
    <li>✅ Automated testing in pipelines</li>
    <li>🚀 Deployment strategies (blue/green, canary)</li>
  </ul>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{dayUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold;">ACCESS DAY 5 →</a>
  </div>
  <p>Just 2 more days! You've got this! 💪</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `Day 5: CI/CD Pipelines!

Hey {{firstName}},

Today everything starts coming together:

DAY 5: CI/CD Pipelines

Pipeline mastery:
- CI/CD concepts & best practices
- GitHub Actions / Jenkins pipelines
- Automated testing in pipelines
- Deployment strategies

Access Day 5: {{dayUrl}}

Just 2 more days! You've got this!
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'dayUrl', description: 'Link to day content', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Day 6',
    slug: 'devops-kickstarter-day-6',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '☸️ Day 6: Kubernetes Essentials - Container Orchestration',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">☸️ Day 6: Kubernetes!</h1>
  <p>Hey {{firstName}},</p>
  <p>The most in-demand DevOps skill right now. Today you'll learn Kubernetes:</p>
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #059669;">Day 6: Kubernetes Essentials</h2>
    <p style="margin: 0;">Master container orchestration and deploy applications at scale.</p>
  </div>
  <p><strong>K8s deep dive:</strong></p>
  <ul>
    <li>☸️ Kubernetes architecture</li>
    <li>📦 Pods, Deployments, Services</li>
    <li>⚖️ Scaling & load balancing</li>
    <li>🔐 ConfigMaps & Secrets</li>
  </ul>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{dayUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold;">ACCESS DAY 6 →</a>
  </div>
  <p>Tomorrow is the final day! 🏁</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `Day 6: Kubernetes!

Hey {{firstName}},

The most in-demand DevOps skill:

DAY 6: Kubernetes Essentials

K8s deep dive:
- Kubernetes architecture
- Pods, Deployments, Services
- Scaling & load balancing
- ConfigMaps & Secrets

Access Day 6: {{dayUrl}}

Tomorrow is the final day!
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'dayUrl', description: 'Link to day content', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Day 7',
    slug: 'devops-kickstarter-day-7',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '🎯 Day 7: Your Portfolio Project - Put It All Together',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">🎯 Day 7: The Final Day!</h1>
  <p>Hey {{firstName}},</p>
  <p>You made it to the final day! 🎉 Today we put everything together:</p>
  <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #059669;">Day 7: Your Portfolio Project</h2>
    <p style="margin: 0;">Build a complete DevOps pipeline you can showcase to employers.</p>
  </div>
  <p><strong>Your capstone project:</strong></p>
  <ul>
    <li>🏗️ Full application with Docker</li>
    <li>🔄 Complete CI/CD pipeline</li>
    <li>☸️ Kubernetes deployment</li>
    <li>📊 Monitoring & observability</li>
  </ul>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{dayUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 35px; border-radius: 8px; text-decoration: none; font-weight: bold;">ACCESS DAY 7 →</a>
  </div>
  <p>🏆 Complete today and you'll have something real to show for your effort!</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `Day 7: The Final Day!

Hey {{firstName}},

You made it! Today we put everything together:

DAY 7: Your Portfolio Project

Your capstone project:
- Full application with Docker
- Complete CI/CD pipeline
- Kubernetes deployment
- Monitoring & observability

Access Day 7: {{dayUrl}}

Complete today and you'll have something real to show!
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'dayUrl', description: 'Link to day content', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Completion',
    slug: 'devops-kickstarter-completion',
    category: EmailTemplateCategory.CHALLENGE,
    subject: '🏆 Congratulations! You Completed the 7-Day DevOps Kickstarter!',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #10b981;">🏆 YOU DID IT!</h1>
  </div>
  <p>Hey {{firstName}},</p>
  <p><strong>Congratulations!</strong> You've completed the 7-Day DevOps Kickstarter!</p>
  <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 25px; margin: 20px 0; text-align: center;">
    <p style="font-size: 48px; margin: 0;">🎖️</p>
    <h2 style="margin: 10px 0; color: #92400e;">Challenge Champion</h2>
    <p style="color: #a16207; margin: 0;">7-Day DevOps Kickstarter Graduate</p>
  </div>
  <p><strong>What you've accomplished:</strong></p>
  <ul>
    <li>✅ Mastered DevOps fundamentals</li>
    <li>✅ Learned Linux & command line</li>
    <li>✅ Git version control</li>
    <li>✅ Docker containerization</li>
    <li>✅ CI/CD pipeline creation</li>
    <li>✅ Kubernetes deployments</li>
    <li>✅ Built a portfolio project</li>
  </ul>
  <p>You now have a solid foundation in DevOps. But this is just the beginning...</p>
  <p style="color: #666;">Tomorrow, I'll share an exclusive opportunity to take your skills to the next level. Stay tuned! 👀</p>
  <p>Proud of you! 🙌</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `YOU DID IT!

Hey {{firstName}},

Congratulations! You've completed the 7-Day DevOps Kickstarter!

What you've accomplished:
- Mastered DevOps fundamentals
- Learned Linux & command line
- Git version control
- Docker containerization
- CI/CD pipeline creation
- Kubernetes deployments
- Built a portfolio project

You now have a solid foundation. But this is just the beginning...

Tomorrow, I'll share an exclusive opportunity. Stay tuned!

Proud of you!
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    name: '7-Day DevOps Kickstarter - Pitch',
    slug: 'devops-kickstarter-pitch',
    category: EmailTemplateCategory.SALES,
    subject: '🎁 Special Offer: Your DevOps Career Accelerator (Expires in 48 Hours)',
    htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">🎁 Exclusive Offer Just For You</h1>
  <p>Hey {{firstName}},</p>
  <p>You crushed the 7-Day DevOps Kickstarter. Now it's time to go deeper.</p>
  <p>I want to invite you to the <strong>Complete DevOps Professional Bootcamp</strong> — our comprehensive program that transforms beginners into job-ready DevOps engineers.</p>

  <div style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); border-radius: 12px; padding: 30px; margin: 25px 0; color: white;">
    <h2 style="margin: 0 0 15px 0; color: #10b981;">Complete DevOps Professional Bootcamp</h2>
    <ul style="padding-left: 20px;">
      <li>12 comprehensive modules</li>
      <li>50+ hours of video content</li>
      <li>Real-world projects</li>
      <li>Cloud lab environments</li>
      <li>Certificate of completion</li>
      <li>Job placement support</li>
    </ul>
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #374151;">
      <span style="text-decoration: line-through; color: #9ca3af;">$497</span>
      <span style="font-size: 32px; font-weight: bold; color: #10b981; margin-left: 10px;">$197</span>
      <span style="color: #f59e0b; margin-left: 10px;">60% OFF</span>
    </div>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{offerUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 18px;">CLAIM YOUR 60% DISCOUNT →</a>
  </div>

  <p style="text-align: center; color: #ef4444; font-weight: bold;">⏰ This offer expires in 48 hours</p>

  <p>This special pricing is exclusively for 7-Day DevOps Kickstarter graduates. After 48 hours, the price goes back to $497.</p>

  <p>Ready to become a DevOps professional?</p>
  <p>— CloudMastersHub Team</p>
</body>
</html>`,
    textContent: `Exclusive Offer Just For You

Hey {{firstName}},

You crushed the 7-Day DevOps Kickstarter. Now it's time to go deeper.

I want to invite you to the Complete DevOps Professional Bootcamp:

- 12 comprehensive modules
- 50+ hours of video content
- Real-world projects
- Cloud lab environments
- Certificate of completion
- Job placement support

Regular Price: $497
YOUR PRICE: $197 (60% OFF)

CLAIM YOUR DISCOUNT: {{offerUrl}}

This offer expires in 48 hours!

Ready to become a DevOps professional?
— CloudMastersHub Team`,
    variables: [
      { name: 'firstName', description: 'Recipient first name', required: false, type: 'string' as const },
      { name: 'offerUrl', description: 'Link to special offer', required: true, type: 'url' as const },
      { name: 'unsubscribeUrl', description: 'Unsubscribe link', required: true, type: 'url' as const },
    ],
    status: EmailTemplateStatus.ACTIVE,
    createdBy: 'system',
    updatedBy: 'system',
  },
];

// ============================================
// CHALLENGE CONFIGURATION
// ============================================

const challengeData = {
  name: '7-Day DevOps Kickstarter',
  slug: '7-days-devops-kickstarter',
  description: 'Transform from DevOps curious to DevOps capable in just 7 days. Learn the essential tools, workflows, and best practices used by DevOps engineers at top tech companies.',
  tagline: 'Your fast-track to DevOps mastery',
  totalDays: 7,
  deliveryMode: DeliveryMode.TIME_BASED,
  days: [
    {
      dayNumber: 1,
      title: 'DevOps Clarity & Career Roadmap',
      description: 'Understand what DevOps really is, the career opportunities, and create your personalized learning roadmap.',
      landingPageId: 'day-1-landing',
      unlockAfterHours: 0,
      estimatedDuration: 45,
      content: {
        videoUrl: '',
        videoTitle: 'What is DevOps? The Complete Overview',
        videoDuration: 25,
        exercises: [
          'Define your DevOps career goals',
          'Map out the DevOps landscape',
          'Identify your learning priorities',
        ],
        resources: [
          { title: 'DevOps Roadmap PDF', url: '/resources/devops-roadmap.pdf', type: 'pdf' as const },
          { title: 'Career Guide', url: '/resources/career-guide.pdf', type: 'pdf' as const },
        ],
      },
      completionCriteria: {
        videoWatchPercent: 80,
        requireExercise: false,
      },
    },
    {
      dayNumber: 2,
      title: 'Linux & Command Line Mastery',
      description: 'Master the essential Linux commands and shell skills every DevOps engineer needs.',
      landingPageId: 'day-2-landing',
      unlockAfterHours: 24,
      estimatedDuration: 60,
      content: {
        videoUrl: '',
        videoTitle: 'Linux Command Line Essentials',
        videoDuration: 35,
        exercises: [
          'Practice 20 essential Linux commands',
          'Write your first shell script',
          'Set up SSH key authentication',
        ],
        resources: [
          { title: 'Linux Cheat Sheet', url: '/resources/linux-cheatsheet.pdf', type: 'pdf' as const },
          { title: 'Shell Script Templates', url: '/resources/shell-templates.zip', type: 'download' as const },
        ],
      },
      completionCriteria: {
        videoWatchPercent: 80,
        requireExercise: true,
      },
    },
    {
      dayNumber: 3,
      title: 'Git & Version Control',
      description: 'Learn professional Git workflows used by development teams worldwide.',
      landingPageId: 'day-3-landing',
      unlockAfterHours: 48,
      estimatedDuration: 50,
      content: {
        videoUrl: '',
        videoTitle: 'Git Mastery for DevOps',
        videoDuration: 30,
        exercises: [
          'Create a Git repository with proper structure',
          'Practice branching and merging',
          'Resolve a merge conflict',
          'Create your first pull request',
        ],
        resources: [
          { title: 'Git Workflow Guide', url: '/resources/git-workflow.pdf', type: 'pdf' as const },
          { title: 'Git Commands Reference', url: '/resources/git-commands.pdf', type: 'pdf' as const },
        ],
      },
      completionCriteria: {
        videoWatchPercent: 80,
        requireExercise: true,
      },
    },
    {
      dayNumber: 4,
      title: 'Docker Fundamentals',
      description: 'Containerize applications with Docker and never say "it works on my machine" again.',
      landingPageId: 'day-4-landing',
      unlockAfterHours: 72,
      estimatedDuration: 60,
      content: {
        videoUrl: '',
        videoTitle: 'Docker from Zero to Hero',
        videoDuration: 40,
        exercises: [
          'Install Docker and run your first container',
          'Write a multi-stage Dockerfile',
          'Create a docker-compose.yml for a multi-service app',
          'Push an image to Docker Hub',
        ],
        resources: [
          { title: 'Dockerfile Best Practices', url: '/resources/dockerfile-best-practices.pdf', type: 'pdf' as const },
          { title: 'Docker Compose Examples', url: '/resources/docker-compose-examples.zip', type: 'download' as const },
        ],
      },
      completionCriteria: {
        videoWatchPercent: 80,
        requireExercise: true,
      },
    },
    {
      dayNumber: 5,
      title: 'CI/CD Pipelines',
      description: 'Build automated pipelines that test, build, and deploy your code.',
      landingPageId: 'day-5-landing',
      unlockAfterHours: 96,
      estimatedDuration: 60,
      content: {
        videoUrl: '',
        videoTitle: 'Building Your First CI/CD Pipeline',
        videoDuration: 45,
        exercises: [
          'Create a GitHub Actions workflow',
          'Add automated testing to your pipeline',
          'Configure automatic deployments',
          'Set up environment variables and secrets',
        ],
        resources: [
          { title: 'CI/CD Pipeline Templates', url: '/resources/cicd-templates.zip', type: 'download' as const },
          { title: 'GitHub Actions Cheat Sheet', url: '/resources/github-actions.pdf', type: 'pdf' as const },
        ],
      },
      completionCriteria: {
        videoWatchPercent: 80,
        requireExercise: true,
      },
    },
    {
      dayNumber: 6,
      title: 'Kubernetes Essentials',
      description: 'Deploy and manage containerized applications with Kubernetes.',
      landingPageId: 'day-6-landing',
      unlockAfterHours: 120,
      estimatedDuration: 60,
      content: {
        videoUrl: '',
        videoTitle: 'Kubernetes for Beginners',
        videoDuration: 45,
        exercises: [
          'Set up a local Kubernetes cluster',
          'Deploy your first pod',
          'Create a Deployment and Service',
          'Scale your application',
        ],
        resources: [
          { title: 'Kubernetes Cheat Sheet', url: '/resources/k8s-cheatsheet.pdf', type: 'pdf' as const },
          { title: 'K8s Manifest Templates', url: '/resources/k8s-manifests.zip', type: 'download' as const },
        ],
      },
      completionCriteria: {
        videoWatchPercent: 80,
        requireExercise: true,
      },
    },
    {
      dayNumber: 7,
      title: 'Your Portfolio Project',
      description: 'Put everything together and build a complete DevOps pipeline you can showcase.',
      landingPageId: 'day-7-landing',
      unlockAfterHours: 144,
      estimatedDuration: 90,
      content: {
        videoUrl: '',
        videoTitle: 'Building Your DevOps Portfolio Project',
        videoDuration: 50,
        exercises: [
          'Fork the starter repository',
          'Containerize the application',
          'Build the complete CI/CD pipeline',
          'Deploy to Kubernetes',
          'Add monitoring and health checks',
        ],
        resources: [
          { title: 'Portfolio Project Starter', url: 'https://github.com/cloudmastershub/devops-portfolio-starter', type: 'link' as const },
          { title: 'Project Requirements', url: '/resources/portfolio-requirements.pdf', type: 'pdf' as const },
        ],
        bonusContent: 'Access to the DevOps interview preparation guide',
      },
      completionCriteria: {
        videoWatchPercent: 80,
        requireExercise: true,
      },
    },
  ],
  pitchDay: {
    dayNumber: 8,
    title: 'Your Next Step: DevOps Professional Bootcamp',
    landingPageId: 'pitch-day-landing',
    offerDetails: {
      productName: 'Complete DevOps Professional Bootcamp',
      originalPrice: 497,
      discountedPrice: 197,
      discountExpiresHours: 48,
      bonuses: [
        'Cloud Lab Environment Access ($200 value)',
        'Resume & LinkedIn Profile Review ($100 value)',
        'Private Discord Community Access',
        '1-on-1 Career Coaching Call ($150 value)',
      ],
    },
  },
  registration: {
    isOpen: true,
    requiresEmail: true,
    requiresName: true,
  },
  community: {
    enabled: true,
    discussionEnabled: true,
    showLeaderboard: true,
    showParticipantCount: true,
  },
  gamification: {
    enabled: true,
    pointsPerDay: 100,
    bonusPointsEarlyCompletion: 50,
    badges: [
      { name: 'Day 1 Complete', description: 'Completed Day 1', iconUrl: '', criteria: 'complete_day_1' },
      { name: 'Halfway Hero', description: 'Completed Day 4', iconUrl: '', criteria: 'complete_day_4' },
      { name: 'Challenge Champion', description: 'Completed all 7 days', iconUrl: '', criteria: 'complete_all' },
      { name: 'Early Bird', description: 'Completed a day early', iconUrl: '', criteria: 'early_completion' },
      { name: 'Perfect Streak', description: '7-day completion streak', iconUrl: '', criteria: 'perfect_streak' },
    ],
  },
  status: ChallengeStatus.DRAFT,
  createdBy: 'system',
  updatedBy: 'system',
};

// ============================================
// FUNNEL CONFIGURATION
// ============================================

const funnelData = {
  name: '7-Day DevOps Kickstarter Registration',
  slug: '7-days-devops-kickstarter',
  description: 'Free 7-day DevOps challenge registration funnel',
  type: FunnelType.LEAD_MAGNET,
  deliveryMode: DeliveryMode.ALL_AT_ONCE,
  settings: {
    showProgressBar: true,
    allowBackNavigation: false,
    collectAnalytics: true,
  },
  design: {
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    fontFamily: 'Inter',
    customCss: '',
  },
  steps: [
    {
      name: 'Challenge Registration',
      type: FunnelStepType.OPTIN,
      order: 1,
      pageContent: {
        headline: '7-Day DevOps Kickstarter',
        subheadline: 'Transform from DevOps curious to DevOps capable in just 7 days',
        description: 'Join thousands of aspiring DevOps engineers in this free challenge. Learn Docker, Kubernetes, CI/CD, and more!',
        ctaText: 'JOIN FREE NOW',
        blocks: [
          {
            id: 'hero-block',
            type: StepBlockType.HERO,
            position: 1,
            data: {
              headline: '7-Day DevOps Kickstarter',
              subheadline: 'Transform from DevOps curious to DevOps capable in just 7 days',
              ctaText: 'JOIN FREE NOW',
              ctaAction: 'next_step',
              backgroundStyle: 'gradient',
              showCountdown: true,
            },
          },
          {
            id: 'benefits-block',
            type: StepBlockType.BENEFITS,
            position: 2,
            data: {
              headline: 'What You\'ll Learn',
              benefits: [
                { icon: 'check', title: 'DevOps Fundamentals', description: 'Understand the complete DevOps landscape' },
                { icon: 'check', title: 'Docker & Containers', description: 'Containerize any application' },
                { icon: 'check', title: 'CI/CD Pipelines', description: 'Automate your deployments' },
                { icon: 'check', title: 'Kubernetes', description: 'Deploy at scale' },
                { icon: 'check', title: 'Portfolio Project', description: 'Build something to showcase' },
              ],
            },
          },
          {
            id: 'optin-block',
            type: StepBlockType.OPTIN_FORM,
            position: 3,
            data: {
              headline: 'Join the Challenge - It\'s FREE',
              fields: ['firstName', 'email'],
              ctaText: 'START MY 7-DAY JOURNEY',
              privacyText: 'We respect your privacy. Unsubscribe anytime.',
            },
          },
        ],
      },
      settings: {
        isRequired: true,
        trackCompletion: true,
      },
    },
    {
      name: 'Welcome - Challenge Starts',
      type: FunnelStepType.THANK_YOU,
      order: 2,
      pageContent: {
        headline: 'You\'re In! 🎉',
        subheadline: 'Check your email for Day 1 access',
        description: 'Welcome to the 7-Day DevOps Kickstarter! Your first lesson is waiting in your inbox.',
        blocks: [
          {
            id: 'thankyou-block',
            type: StepBlockType.TEXT,
            position: 1,
            data: {
              headline: 'You\'re In! 🎉',
              content: 'Welcome to the 7-Day DevOps Kickstarter! Check your email for Day 1 access.',
            },
          },
        ],
      },
      settings: {
        trackCompletion: true,
      },
    },
  ],
  status: FunnelStatus.DRAFT,
  createdBy: 'system',
  updatedBy: 'system',
};

// ============================================
// EMAIL SEQUENCE CONFIGURATION
// ============================================

const sequenceData = {
  name: '7-Day DevOps Kickstarter Sequence',
  slug: 'devops-kickstarter-sequence',
  description: 'Automated email sequence for the 7-day challenge',
  trigger: SequenceTrigger.CHALLENGE_START,
  triggerConfig: {
    // challengeId will be set after challenge is created
  },
  settings: {
    timezone: 'America/Los_Angeles',
    businessHoursStart: 9,
    businessHoursEnd: 17,
    skipWeekends: false,
    unsubscribeLinkRequired: true,
    fromName: 'CloudMastersHub',
    fromEmail: 'challenge@mail.cloudmastershub.com',
    replyTo: 'support@cloudmastershub.com',
  },
  emails: [
    {
      id: 'email-1',
      order: 1,
      name: 'Welcome Email',
      templateId: '', // Will be set after templates are created
      delayHours: 0,
      sendTime: SendTimeOption.IMMEDIATE,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-2',
      order: 2,
      name: 'Day 2 Unlock',
      templateId: '',
      delayHours: 24,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 9,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-3',
      order: 3,
      name: 'Day 3 Unlock',
      templateId: '',
      delayHours: 48,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 9,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-4',
      order: 4,
      name: 'Day 4 Unlock',
      templateId: '',
      delayHours: 72,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 9,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-5',
      order: 5,
      name: 'Day 5 Unlock',
      templateId: '',
      delayHours: 96,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 9,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-6',
      order: 6,
      name: 'Day 6 Unlock',
      templateId: '',
      delayHours: 120,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 9,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-7',
      order: 7,
      name: 'Day 7 Unlock',
      templateId: '',
      delayHours: 144,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 9,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-8',
      order: 8,
      name: 'Completion Email',
      templateId: '',
      delayHours: 168,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 9,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
    {
      id: 'email-9',
      order: 9,
      name: 'Pitch Email',
      templateId: '',
      delayHours: 192,
      sendTime: SendTimeOption.SCHEDULED,
      scheduledHour: 10,
      conditions: {},
      metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    },
  ],
  exitConditions: {
    onUnsubscribe: true,
    onPurchase: true,
  },
  status: EmailSequenceStatus.DRAFT,
  createdBy: 'system',
  updatedBy: 'system',
};

// ============================================
// SEED FUNCTION
// ============================================

async function seed() {
  console.log('🌱 Starting 7-Day DevOps Kickstarter seed...\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Create Email Templates
    console.log('📧 Creating email templates...');
    const createdTemplates: Record<string, string> = {};

    for (const template of emailTemplates) {
      const existing = await EmailTemplate.findOne({ slug: template.slug });
      if (existing) {
        console.log(`   ⏭️  Template "${template.slug}" already exists, skipping`);
        createdTemplates[template.slug] = existing._id.toString();
      } else {
        const created = await EmailTemplate.create(template);
        createdTemplates[template.slug] = created._id.toString();
        console.log(`   ✅ Created template: ${template.name}`);
      }
    }
    console.log(`✅ Created ${Object.keys(createdTemplates).length} email templates\n`);

    // 2. Create Funnel
    console.log('🎯 Creating funnel...');
    let funnel = await Funnel.findOne({ slug: funnelData.slug });
    if (funnel) {
      console.log(`   ⏭️  Funnel "${funnelData.slug}" already exists`);
    } else {
      funnel = await Funnel.create(funnelData);
      console.log(`   ✅ Created funnel: ${funnelData.name}`);
    }
    console.log('');

    // 3. Create Challenge (requires funnelId)
    console.log('🏆 Creating challenge...');
    let challenge = await Challenge.findOne({ slug: challengeData.slug });
    if (challenge) {
      console.log(`   ⏭️  Challenge "${challengeData.slug}" already exists`);
    } else {
      // Add funnelId to challenge data
      const challengeWithFunnel = {
        ...challengeData,
        funnelId: funnel._id,
        emails: {
          welcomeEmailId: createdTemplates['devops-kickstarter-welcome'],
          completionEmailId: createdTemplates['devops-kickstarter-completion'],
          reminderEmailIds: [
            createdTemplates['devops-kickstarter-day-2'],
            createdTemplates['devops-kickstarter-day-3'],
            createdTemplates['devops-kickstarter-day-4'],
            createdTemplates['devops-kickstarter-day-5'],
            createdTemplates['devops-kickstarter-day-6'],
            createdTemplates['devops-kickstarter-day-7'],
          ],
        },
        // Link email templates to days
        days: challengeData.days.map((day, index) => ({
          ...day,
          emailTemplateId: index === 0
            ? createdTemplates['devops-kickstarter-welcome']
            : createdTemplates[`devops-kickstarter-day-${day.dayNumber}`],
        })),
        pitchDay: {
          ...challengeData.pitchDay,
          emailTemplateId: createdTemplates['devops-kickstarter-pitch'],
        },
      };
      challenge = await Challenge.create(challengeWithFunnel);
      console.log(`   ✅ Created challenge: ${challengeData.name}`);
    }
    console.log('');

    // 4. Create Email Sequence
    console.log('📬 Creating email sequence...');
    let sequence = await EmailSequence.findOne({ slug: sequenceData.slug });
    if (sequence) {
      console.log(`   ⏭️  Sequence "${sequenceData.slug}" already exists`);
    } else {
      // Map template IDs to sequence steps
      const templateSlugs = [
        'devops-kickstarter-welcome',
        'devops-kickstarter-day-2',
        'devops-kickstarter-day-3',
        'devops-kickstarter-day-4',
        'devops-kickstarter-day-5',
        'devops-kickstarter-day-6',
        'devops-kickstarter-day-7',
        'devops-kickstarter-completion',
        'devops-kickstarter-pitch',
      ];

      const sequenceWithTemplates = {
        ...sequenceData,
        triggerConfig: {
          challengeId: challenge._id.toString(),
        },
        emails: sequenceData.emails.map((email, index) => ({
          ...email,
          templateId: createdTemplates[templateSlugs[index]],
        })),
      };
      sequence = await EmailSequence.create(sequenceWithTemplates);
      console.log(`   ✅ Created sequence: ${sequenceData.name}`);
    }
    console.log('');

    // Summary
    console.log('═'.repeat(50));
    console.log('✅ SEED COMPLETE!\n');
    console.log('📋 Created Resources:');
    console.log(`   • Email Templates: ${emailTemplates.length}`);
    console.log(`   • Funnel: ${funnelData.name}`);
    console.log(`   • Challenge: ${challengeData.name}`);
    console.log(`   • Email Sequence: ${sequenceData.name}`);
    console.log('');
    console.log('🔗 Access URLs:');
    console.log(`   • Funnel: https://cloudmastershub.com/f/${funnelData.slug}`);
    console.log(`   • Challenge: https://cloudmastershub.com/challenge/${challengeData.slug}`);
    console.log('');
    console.log('⚠️  NEXT STEPS:');
    console.log('   1. Review and publish the funnel in Admin → Funnels');
    console.log('   2. Review and publish the challenge in Admin → Challenges');
    console.log('   3. Activate the email sequence in Admin → Email Sequences');
    console.log('   4. Test the registration flow end-to-end');
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run seed
seed().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

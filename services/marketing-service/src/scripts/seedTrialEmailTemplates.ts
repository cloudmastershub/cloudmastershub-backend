/**
 * Seed Trial Email Templates
 *
 * This script creates email templates for the subscription trial flow:
 * - trial-started-welcome: Welcome email when trial starts
 * - trial-reminder-day-7: Halfway reminder
 * - trial-reminder-day-10: 4 days left
 * - trial-reminder-day-12: 2 days left
 * - trial-reminder-day-13: Final day reminder
 * - subscription-paused: Pause confirmation
 * - subscription-resumed: Resume confirmation
 *
 * Run with: npx ts-node src/scripts/seedTrialEmailTemplates.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EmailTemplate, EmailTemplateCategory, EmailTemplateStatus } from '../models/EmailTemplate';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub_marketing';
const SYSTEM_USER = 'system';

const trialTemplates = [
  {
    name: 'Trial Started Welcome',
    description: 'Welcome email sent when a user starts their free trial',
    category: EmailTemplateCategory.WELCOME,
    status: EmailTemplateStatus.ACTIVE,
    subject: 'Your {{trialDays}}-day free trial has started! 🚀',
    preheader: 'Welcome to CloudMastersHub - your cloud learning journey begins now',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #40E0D0 0%, #4682B4 100%); padding: 40px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to {{planName}}!</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{firstName}},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Your <strong>{{trialDays}}-day free trial</strong> is now active. You have full access to all {{planName}} features until <strong>{{trialEndsAt}}</strong>.
              </p>
              <h3 style="color: #333; margin-top: 30px;">What you can do now:</h3>
              <ul style="color: #555; line-height: 1.8;">
                <li>Access all {{planName}} courses</li>
                <li>Start hands-on cloud labs (AWS, Azure, GCP)</li>
                <li>Track your learning progress</li>
                <li>Join our community discussions</li>
                <li>Earn certificates as you complete courses</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{dashboardLink}}" style="background: #40E0D0; color: #000; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
              </div>
              <div style="background: #f8f9fa; border-radius: 6px; padding: 16px; margin-top: 30px;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  <strong>No surprises:</strong> Your card won't be charged until the trial ends. You can cancel anytime from your <a href="{{subscriptionLink}}" style="color: #4682B4;">subscription settings</a>.
                </p>
              </div>
              <p style="font-size: 16px; color: #333; margin-top: 30px;">Happy learning!</p>
              <p style="font-size: 16px; color: #333;">The CloudMastersHub Team</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© {{currentYear}} CloudMastersHub. All rights reserved.</p>
              <p style="margin: 10px 0 0 0;">
                <a href="{{unsubscribeLink}}" style="color: #666;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    variables: [
      { name: 'firstName', description: 'User first name', required: true, type: 'string' as const },
      { name: 'planName', description: 'Subscription plan name', required: true, type: 'string' as const },
      { name: 'trialDays', description: 'Number of trial days', required: true, type: 'number' as const },
      { name: 'trialEndsAt', description: 'Trial end date formatted', required: true, type: 'string' as const },
      { name: 'dashboardLink', description: 'Link to user dashboard', required: true, type: 'url' as const },
      { name: 'subscriptionLink', description: 'Link to subscription management', required: true, type: 'url' as const },
    ],
    tags: ['trial', 'welcome', 'subscription', 'automated'],
    tracking: { trackOpens: true, trackClicks: true },
  },
  {
    name: 'Trial Reminder - Day 7',
    description: 'Halfway reminder sent on day 7 of 14-day trial',
    category: EmailTemplateCategory.REMINDER,
    status: EmailTemplateStatus.ACTIVE,
    subject: '7 days left in your {{planName}} trial - how\'s it going?',
    preheader: 'You\'re halfway through your trial - make the most of it!',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: #4682B4; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Halfway There! 🎯</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{firstName}},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                You're halfway through your {{planName}} trial! Just wanted to check in and make sure you're getting the most out of it.
              </p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Your trial ends on <strong>{{trialEndsAt}}</strong>.
              </p>
              <h3 style="color: #333; margin-top: 30px;">Make the most of your remaining time:</h3>
              <ul style="color: #555; line-height: 1.8;">
                <li>Dive into our most popular courses</li>
                <li>Try a hands-on lab environment</li>
                <li>Complete a learning path</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{dashboardLink}}" style="background: #40E0D0; color: #000; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Continue Learning</a>
              </div>
              <p style="font-size: 16px; color: #333; margin-top: 30px;">Keep up the great work!</p>
              <p style="font-size: 16px; color: #333;">The CloudMastersHub Team</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© {{currentYear}} CloudMastersHub</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    variables: [
      { name: 'firstName', description: 'User first name', required: true, type: 'string' as const },
      { name: 'planName', description: 'Subscription plan name', required: true, type: 'string' as const },
      { name: 'trialEndsAt', description: 'Trial end date formatted', required: true, type: 'string' as const },
      { name: 'dashboardLink', description: 'Link to user dashboard', required: true, type: 'url' as const },
    ],
    tags: ['trial', 'reminder', 'subscription', 'automated', 'day-7'],
    tracking: { trackOpens: true, trackClicks: true },
  },
  {
    name: 'Trial Reminder - Day 10',
    description: 'Reminder sent on day 10 (4 days remaining)',
    category: EmailTemplateCategory.REMINDER,
    status: EmailTemplateStatus.ACTIVE,
    subject: '⏰ Only 4 days left in your {{planName}} trial',
    preheader: 'Your trial is ending soon - don\'t miss out on continued access',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: #FF9800; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">4 Days Remaining</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{firstName}},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Just a friendly reminder that your {{planName}} trial ends on <strong>{{trialEndsAt}}</strong>.
              </p>
              <div style="background: #FFF3E0; border-left: 4px solid #FF9800; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #E65100;">
                  <strong>Good news:</strong> Your subscription will automatically continue after the trial, so you won't lose access to your courses and progress.
                </p>
              </div>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Have you explored everything {{planName}} has to offer?
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{dashboardLink}}" style="background: #40E0D0; color: #000; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Explore More</a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Want to manage your subscription? <a href="{{subscriptionLink}}" style="color: #4682B4;">Click here</a>
              </p>
              <p style="font-size: 16px; color: #333;">The CloudMastersHub Team</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© {{currentYear}} CloudMastersHub</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    variables: [
      { name: 'firstName', description: 'User first name', required: true, type: 'string' as const },
      { name: 'planName', description: 'Subscription plan name', required: true, type: 'string' as const },
      { name: 'trialEndsAt', description: 'Trial end date formatted', required: true, type: 'string' as const },
      { name: 'dashboardLink', description: 'Link to user dashboard', required: true, type: 'url' as const },
      { name: 'subscriptionLink', description: 'Link to subscription management', required: true, type: 'url' as const },
    ],
    tags: ['trial', 'reminder', 'subscription', 'automated', 'day-10'],
    tracking: { trackOpens: true, trackClicks: true },
  },
  {
    name: 'Trial Reminder - Day 12',
    description: 'Urgent reminder sent on day 12 (2 days remaining)',
    category: EmailTemplateCategory.REMINDER,
    status: EmailTemplateStatus.ACTIVE,
    subject: '⚠️ 2 days left - Your {{planName}} trial ends soon',
    preheader: 'Your trial ends in 2 days - take action now',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: #F44336; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ 2 Days Left</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{firstName}},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Your {{planName}} trial ends in <strong>2 days</strong> on {{trialEndsAt}}.
              </p>
              <div style="background: #FFEBEE; border-left: 4px solid #F44336; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #C62828;">
                  <strong>Important:</strong> After your trial, your subscription will continue automatically so you don't lose access to any courses or your learning progress.
                </p>
              </div>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Make sure you've tried everything you wanted to explore!
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{dashboardLink}}" style="background: #40E0D0; color: #000; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Continue Learning</a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Need to make changes? <a href="{{subscriptionLink}}" style="color: #4682B4;">Manage your subscription</a>
              </p>
              <p style="font-size: 16px; color: #333;">The CloudMastersHub Team</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© {{currentYear}} CloudMastersHub</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    variables: [
      { name: 'firstName', description: 'User first name', required: true, type: 'string' as const },
      { name: 'planName', description: 'Subscription plan name', required: true, type: 'string' as const },
      { name: 'trialEndsAt', description: 'Trial end date formatted', required: true, type: 'string' as const },
      { name: 'dashboardLink', description: 'Link to user dashboard', required: true, type: 'url' as const },
      { name: 'subscriptionLink', description: 'Link to subscription management', required: true, type: 'url' as const },
    ],
    tags: ['trial', 'reminder', 'subscription', 'automated', 'day-12', 'urgent'],
    tracking: { trackOpens: true, trackClicks: true },
  },
  {
    name: 'Trial Reminder - Final Day',
    description: 'Final reminder sent on day 13 (last day of trial)',
    category: EmailTemplateCategory.REMINDER,
    status: EmailTemplateStatus.ACTIVE,
    subject: '🚨 FINAL DAY - Your {{planName}} trial ends tomorrow',
    preheader: 'This is your last day of trial access',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Final Day of Your Trial</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{firstName}},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                This is it - your {{planName}} trial ends <strong>tomorrow</strong> on {{trialEndsAt}}.
              </p>
              <div style="background: #FFCDD2; border: 2px solid #F44336; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #B71C1C; font-size: 18px;">
                  <strong>Your subscription will automatically continue tomorrow to keep your access uninterrupted.</strong>
                </p>
              </div>
              <h3 style="color: #333; margin-top: 30px;">Before your trial ends:</h3>
              <ul style="color: #555; line-height: 1.8;">
                <li>Finish any in-progress courses</li>
                <li>Download any certificates you've earned</li>
                <li>Bookmark courses you want to continue</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{dashboardLink}}" style="background: #40E0D0; color: #000; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Go to Dashboard</a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
                <a href="{{subscriptionLink}}" style="color: #4682B4;">Manage subscription</a>
              </p>
              <p style="font-size: 16px; color: #333;">The CloudMastersHub Team</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© {{currentYear}} CloudMastersHub</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    variables: [
      { name: 'firstName', description: 'User first name', required: true, type: 'string' as const },
      { name: 'planName', description: 'Subscription plan name', required: true, type: 'string' as const },
      { name: 'trialEndsAt', description: 'Trial end date formatted', required: true, type: 'string' as const },
      { name: 'dashboardLink', description: 'Link to user dashboard', required: true, type: 'url' as const },
      { name: 'subscriptionLink', description: 'Link to subscription management', required: true, type: 'url' as const },
    ],
    tags: ['trial', 'reminder', 'subscription', 'automated', 'day-13', 'final', 'urgent'],
    tracking: { trackOpens: true, trackClicks: true },
  },
  {
    name: 'Subscription Paused',
    description: 'Confirmation email when subscription is paused',
    category: EmailTemplateCategory.NOTIFICATION,
    status: EmailTemplateStatus.ACTIVE,
    subject: 'Your {{planName}} subscription is paused',
    preheader: 'Your subscription has been paused - you can resume anytime',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: #607D8B; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Paused ⏸️</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{firstName}},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Your {{planName}} subscription has been paused. You won't be charged during this time.
              </p>
              <div style="background: #E3F2FD; border: 1px solid #2196F3; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; color: #1565C0;">
                  <strong>Important:</strong> Your pause period expires on <strong>{{pauseExpiresAt}}</strong>. After this date, your subscription will automatically resume.
                </p>
              </div>
              <h3 style="color: #333; margin-top: 30px;">During the pause period:</h3>
              <ul style="color: #555; line-height: 1.8;">
                <li>You won't be charged</li>
                <li>Your course progress is saved</li>
                <li>Your certificates are preserved</li>
                <li>You can resume anytime</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{subscriptionLink}}" style="background: #40E0D0; color: #000; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Resume Subscription</a>
              </div>
              <p style="font-size: 16px; color: #333; margin-top: 30px;">We hope to see you back soon!</p>
              <p style="font-size: 16px; color: #333;">The CloudMastersHub Team</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© {{currentYear}} CloudMastersHub</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    variables: [
      { name: 'firstName', description: 'User first name', required: true, type: 'string' as const },
      { name: 'planName', description: 'Subscription plan name', required: true, type: 'string' as const },
      { name: 'pauseExpiresAt', description: 'Pause expiration date', required: true, type: 'string' as const },
      { name: 'subscriptionLink', description: 'Link to subscription management', required: true, type: 'url' as const },
    ],
    tags: ['subscription', 'paused', 'notification', 'automated'],
    tracking: { trackOpens: true, trackClicks: true },
  },
  {
    name: 'Subscription Resumed',
    description: 'Confirmation email when subscription is resumed',
    category: EmailTemplateCategory.NOTIFICATION,
    status: EmailTemplateStatus.ACTIVE,
    subject: 'Welcome back! Your {{planName}} subscription is active 🎉',
    preheader: 'Your subscription has been resumed - pick up where you left off',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome Back! 🎉</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{firstName}},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Great news! Your {{planName}} subscription is now <strong>active again</strong>.
              </p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                You have full access to all your courses, labs, and progress.
              </p>
              <div style="background: #E8F5E9; border-left: 4px solid #4CAF50; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #2E7D32;">
                  Your next billing date is <strong>{{nextBillingDate}}</strong>.
                </p>
              </div>
              <h3 style="color: #333; margin-top: 30px;">Pick up where you left off:</h3>
              <ul style="color: #555; line-height: 1.8;">
                <li>Continue your in-progress courses</li>
                <li>Explore new content we've added</li>
                <li>Start hands-on labs</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{dashboardLink}}" style="background: #40E0D0; color: #000; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Go to Dashboard</a>
              </div>
              <p style="font-size: 16px; color: #333; margin-top: 30px;">Happy learning!</p>
              <p style="font-size: 16px; color: #333;">The CloudMastersHub Team</p>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© {{currentYear}} CloudMastersHub</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
    variables: [
      { name: 'firstName', description: 'User first name', required: true, type: 'string' as const },
      { name: 'planName', description: 'Subscription plan name', required: true, type: 'string' as const },
      { name: 'nextBillingDate', description: 'Next billing date', required: true, type: 'string' as const },
      { name: 'dashboardLink', description: 'Link to user dashboard', required: true, type: 'url' as const },
    ],
    tags: ['subscription', 'resumed', 'notification', 'automated'],
    tracking: { trackOpens: true, trackClicks: true },
  },
];

async function seedTrialEmailTemplates() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('Seeding trial email templates...');

    for (const templateData of trialTemplates) {
      // Check if template already exists
      const existing = await EmailTemplate.findOne({ name: templateData.name });

      if (existing) {
        console.log(`  - Template "${templateData.name}" already exists, updating...`);
        await EmailTemplate.findByIdAndUpdate(existing._id, {
          ...templateData,
          updatedBy: SYSTEM_USER,
        });
      } else {
        console.log(`  - Creating template: "${templateData.name}"`);
        await EmailTemplate.create({
          ...templateData,
          createdBy: SYSTEM_USER,
          updatedBy: SYSTEM_USER,
        });
      }
    }

    console.log(`\nSuccessfully seeded ${trialTemplates.length} trial email templates!`);

    // List all templates
    const allTemplates = await EmailTemplate.find({ tags: 'trial' }).select('name status');
    console.log('\nTrial email templates in database:');
    allTemplates.forEach(t => {
      console.log(`  - ${t.name} (${t.status})`);
    });

  } catch (error) {
    console.error('Error seeding trial email templates:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  seedTrialEmailTemplates();
}

export { seedTrialEmailTemplates, trialTemplates };

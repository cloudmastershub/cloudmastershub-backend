#!/usr/bin/env node

/**
 * Test script to create a Stripe checkout session
 * This simulates what would happen when a user clicks "Subscribe"
 */

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const API_BASE = 'http://localhost:3004/api';

// Test JWT token (in production, this would come from user login)
const TEST_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testCheckoutFlow() {
  console.log('🛒 Stripe Checkout Test\n');
  console.log('This script will create a test checkout session.');
  console.log('You can use Stripe test cards to complete the payment.\n');

  try {
    // 1. Display available plans
    console.log('📋 Fetching available subscription plans...\n');
    const plansResponse = await axios.get(`${API_BASE}/subscriptions/plans`);
    const plans = plansResponse.data.data;

    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} - $${plan.price}/${plan.interval}`);
      console.log(`   ${plan.description}`);
      console.log(`   Features: ${plan.features.slice(0, 3).join(', ')}...`);
      console.log();
    });

    // 2. Let user select a plan
    const selection = await question('Select a plan number (or press Enter for Premium Monthly): ');
    const planIndex = selection ? parseInt(selection) - 1 : 1; // Default to Premium Monthly
    const selectedPlan = plans[planIndex];

    if (!selectedPlan) {
      console.error('Invalid selection');
      process.exit(1);
    }

    console.log(`\n✅ Selected: ${selectedPlan.name}\n`);

    // 3. Create checkout session
    console.log('🔄 Creating checkout session...\n');
    
    const checkoutData = {
      planId: selectedPlan.stripeProductId,
      successUrl: 'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:3000/payment/cancel'
    };

    // In a real app, you'd get the JWT from the logged-in user
    const response = await axios.post(
      `${API_BASE}/subscriptions/checkout`,
      checkoutData,
      {
        headers: {
          'Authorization': `Bearer ${TEST_JWT}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { checkoutUrl } = response.data.data;

    console.log('✅ Checkout session created!\n');
    console.log('🔗 Checkout URL:', checkoutUrl);
    console.log('\n📝 Test Card Numbers:');
    console.log('   - Success: 4242 4242 4242 4242');
    console.log('   - Requires authentication: 4000 0025 0000 3155');
    console.log('   - Declined: 4000 0000 0000 9995');
    console.log('\n   Use any future expiry date and any 3-digit CVC\n');

    const openBrowser = await question('Open checkout page in browser? (y/n): ');
    if (openBrowser.toLowerCase() === 'y') {
      const open = require('open');
      open(checkoutUrl);
      console.log('\n✅ Opened in browser!');
    }

    console.log('\n👀 Watch the Stripe CLI terminal for webhook events!');
    console.log('   You should see events like:');
    console.log('   - checkout.session.completed');
    console.log('   - customer.subscription.created');
    console.log('   - invoice.payment_succeeded\n');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data?.error || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Note: In production, you\'d need a valid JWT token from user login');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Make sure the payment service is running on port 3004');
    }
  } finally {
    rl.close();
  }
}

// Check if 'open' package is installed for browser opening
try {
  require.resolve('open');
} catch (e) {
  console.log('💡 Tip: Run "npm install open" to enable automatic browser opening\n');
}

// Run the test
testCheckoutFlow().catch(console.error);
import { browserManager } from '../server/browserManager.js';
import { db } from '../server/database.js';

async function runBrowserTests() {
  console.log('--- Testing Browser Manager & Optional TARGET_URL Resolution ---');

  // Test 1: Start with NO target URL configured (Empty / Undefined)
  db.updateSettings({ targetUrl: '' });
  const status1 = browserManager.getStatus();
  if (status1.configuredUrl !== '') {
    throw new Error('Test 1 Failed: configuredUrl should be empty when no TARGET_URL is provided');
  }

  const openRes1 = await browserManager.openTarget();
  if (!openRes1.success) {
    throw new Error(`Test 1 Failed: openTarget should succeed in ready state without crashing: ${openRes1.error}`);
  }
  const statusOpen1 = browserManager.getStatus();
  if (!statusOpen1.isOpen) {
    throw new Error('Test 1 Failed: Browser session should be open in ready state');
  }
  console.log('✓ Test 1 Passed: Empty TARGET_URL does not crash, opens in ready state');

  // Test 2: Manual URL Override from Browser Panel / Step
  const openRes2 = await browserManager.openTarget('https://manual-target.example.org/form');
  if (!openRes2.success || openRes2.url !== 'https://manual-target.example.org/form') {
    throw new Error(`Test 2 Failed: Manual override URL was not opened: ${openRes2.error}`);
  }
  const statusOpen2 = browserManager.getStatus();
  if (statusOpen2.currentUrl !== 'https://manual-target.example.org/form') {
    throw new Error('Test 2 Failed: Current URL should reflect manual target');
  }
  console.log('✓ Test 2 Passed: Manual URL override takes effect immediately');

  // Test 3: Setting a Default TARGET_URL in Settings
  db.updateSettings({ targetUrl: 'https://configured-default.example.com/app' });
  const openRes3 = await browserManager.openTarget();
  if (!openRes3.success || openRes3.url !== 'https://configured-default.example.com/app') {
    throw new Error(`Test 3 Failed: Configured default target URL was not used: ${openRes3.error}`);
  }
  console.log('✓ Test 3 Passed: Configured default TARGET_URL is used when no override is provided');

  // Test 4: Workflow Specific URL Override takes precedence over Default TARGET_URL
  const openRes4 = await browserManager.openTarget('https://workflow-specific.org/login');
  if (!openRes4.success || openRes4.url !== 'https://workflow-specific.org/login') {
    throw new Error('Test 4 Failed: Workflow-specific URL should take precedence over default setting');
  }
  console.log('✓ Test 4 Passed: Workflow specific URL takes precedence over default setting');

  // Test 5: Browser Action Execution (NAVIGATE, TYPE, CLICK, WAIT)
  const navAction = await browserManager.executeAction({
    type: 'NAVIGATE',
    target: 'https://workflow-specific.org/dashboard'
  });
  if (!navAction.success) {
    throw new Error(`Test 5 Failed on NAVIGATE: ${navAction.error}`);
  }

  const typeAction = await browserManager.executeAction({
    type: 'TYPE',
    target: 'input[name="first_name"]',
    value: 'Opérateur'
  });
  if (!typeAction.success) {
    throw new Error(`Test 5 Failed on TYPE: ${typeAction.error}`);
  }

  const waitAction = await browserManager.executeAction({
    type: 'WAIT',
    timeoutMs: 100
  });
  if (!waitAction.success) {
    throw new Error(`Test 5 Failed on WAIT: ${waitAction.error}`);
  }

  console.log('✓ Test 5 Passed: Browser actions (NAVIGATE, TYPE, WAIT) execute smoothly');

  // Close session
  browserManager.closeSession();
  const finalStatus = browserManager.getStatus();
  if (finalStatus.isOpen) {
    throw new Error('Test 6 Failed: Browser session should be closed');
  }
  console.log('✓ Test 6 Passed: Browser session closed properly');

  console.log('All Browser Manager & Optional TARGET_URL tests passed successfully!\n');
}

runBrowserTests().catch(err => {
  console.error('Browser test failed:', err);
  process.exit(1);
});

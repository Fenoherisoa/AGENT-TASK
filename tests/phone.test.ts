import { phoneProvider } from '../server/phoneProvider';
import { db } from '../server/database';

async function runPhoneTests() {
  console.log('--- Testing Phone Provider & Isolation ---');

  const task1 = db.createTask({
    telegramTaskId: `PHONE-TEST-1-${Date.now()}`,
    telegramChatId: 'test-chat-999',
    telegramMessageId: `msg-${Date.now()}-1`,
    sourceType: 'TELEGRAM',
    firstName: 'User1',
    lastName: 'Test',
    password: 'Password1!',
    status: 'PENDING'
  });

  const task2 = db.createTask({
    telegramTaskId: `PHONE-TEST-2-${Date.now()}`,
    telegramChatId: 'test-chat-999',
    telegramMessageId: `msg-${Date.now()}-2`,
    sourceType: 'TELEGRAM',
    firstName: 'User2',
    lastName: 'Test',
    password: 'Password2!',
    status: 'PENDING'
  });

  // Test 1: Assign to task 1
  const res1 = await phoneProvider.getNumber(task1.id);
  if (!res1.success || !res1.phone) {
    throw new Error('Test 1 Failed: Phone allocation');
  }
  console.log(`✓ Test 1 Passed: Assigned ${res1.phone} to Task 1`);

  // Test 2: Assign to task 2 (Must be different number)
  const res2 = await phoneProvider.getNumber(task2.id);
  if (!res2.success || !res2.phone || res2.phone === res1.phone) {
    throw new Error('Test 2 Failed: Numbers must be unique and isolated');
  }
  console.log(`✓ Test 2 Passed: Assigned ${res2.phone} to Task 2 with unique isolation`);

  // Test 3: Release Task 1 number
  const rel1 = await phoneProvider.releaseNumber(task1.id);
  if (!rel1.success) {
    throw new Error('Test 3 Failed: Release phone');
  }
  console.log('✓ Test 3 Passed: Successfully released phone from Task 1');

  // Clean up
  db.deleteTask(task1.id);
  db.deleteTask(task2.id);

  console.log('All phone provider tests passed successfully!\n');
}

runPhoneTests();

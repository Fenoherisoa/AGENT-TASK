import { db } from '../server/database';

function runQueueTests() {
  console.log('--- Testing Task Queue & Lifecycle ---');

  // Test 1: Create Task
  const task = db.createTask({
    telegramTaskId: `UNIT-TEST-1-${Date.now()}`,
    telegramChatId: 'test-chat-888',
    telegramMessageId: `msg-${Date.now()}`,
    sourceType: 'TELEGRAM',
    firstName: 'Alice',
    lastName: 'Smith',
    password: 'UnitPassword123!',
    status: 'PENDING'
  });

  if (!task.id || task.status !== 'PENDING') {
    throw new Error('Test 1 Failed: Task creation');
  }
  console.log('✓ Test 1 Passed: Task created with PENDING status');

  // Test 2: Transition to IN_PROGRESS
  const started = db.updateTask(task.id, { status: 'IN_PROGRESS' });
  if (started?.status !== 'IN_PROGRESS') {
    throw new Error('Test 2 Failed: Status transition to IN_PROGRESS');
  }
  console.log('✓ Test 2 Passed: Transition to IN_PROGRESS');

  // Test 3: Transition to WAITING_MANUAL_ACTION
  const manual = db.updateTask(task.id, { status: 'WAITING_MANUAL_ACTION' });
  if (manual?.status !== 'WAITING_MANUAL_ACTION') {
    throw new Error('Test 3 Failed: Status transition to WAITING_MANUAL_ACTION');
  }
  console.log('✓ Test 3 Passed: Transition to WAITING_MANUAL_ACTION');

  // Test 4: Complete Task
  const completed = db.updateTask(task.id, { status: 'COMPLETED' });
  if (completed?.status !== 'COMPLETED') {
    throw new Error('Test 4 Failed: Status transition to COMPLETED');
  }
  console.log('✓ Test 4 Passed: Transition to COMPLETED');

  // Clean up
  db.deleteTask(task.id);

  console.log('All queue tests passed successfully!\n');
}

runQueueTests();

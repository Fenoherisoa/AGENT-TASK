import { parseTelegramTaskMessage } from '../server/taskParser';

function runParserTests() {
  console.log('--- Testing Telegram Task Parser ---');

  // Test 1: Standard French Format
  const frenchSample = `TASK #12345\n\nPrénom: Jean\nNom: Dupont\nMot de passe: ExamplePassword123\nTéléphone: +33612345678`;
  const res1 = parseTelegramTaskMessage(frenchSample);
  if (!res1.success || res1.task?.firstName !== 'Jean' || res1.task?.lastName !== 'Dupont' || res1.task?.password !== 'ExamplePassword123') {
    throw new Error(`Test 1 Failed: ${res1.error || 'Field mismatch'}`);
  }
  console.log('✓ Test 1 Passed: Standard French Format parsed');

  // Test 2: English Format
  const englishSample = `TASK #99001\nFirst Name: Sarah\nLast Name: Connor\nPassword: CyberPass990$\nPhone: +14155552671`;
  const res2 = parseTelegramTaskMessage(englishSample);
  if (!res2.success || res2.task?.firstName !== 'Sarah' || res2.task?.lastName !== 'Connor') {
    throw new Error(`Test 2 Failed: ${res2.error}`);
  }
  console.log('✓ Test 2 Passed: English Format parsed');

  // Test 3: JSON Format
  const jsonSample = JSON.stringify({
    taskId: '8877',
    firstName: 'Thomas',
    lastName: 'Anderson',
    password: 'MatrixPassWord99!',
    phone: '+12025550189'
  });
  const res3 = parseTelegramTaskMessage(jsonSample);
  if (!res3.success || res3.task?.telegramTaskId !== '8877') {
    throw new Error(`Test 3 Failed: ${res3.error}`);
  }
  console.log('✓ Test 3 Passed: JSON Format parsed');

  // Test 4: Missing Required Field (Error Handling)
  const invalidSample = `TASK #000\nPrénom: Incomplet`;
  const res4 = parseTelegramTaskMessage(invalidSample);
  if (res4.success) {
    throw new Error('Test 4 Failed: Parser should reject missing fields');
  }
  console.log('✓ Test 4 Passed: Missing fields properly rejected');

  console.log('All parser tests passed successfully!\n');
}

runParserTests();

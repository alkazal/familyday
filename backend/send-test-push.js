const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

function loadVapid() {
  const fromEnv = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;
  if (fromEnv) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com' };
  }

  const jsonPath = path.join(__dirname, '.vapid_keys.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return { publicKey: j.publicKey, privateKey: j.privateKey, subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com' };
    } catch (err) {}
  }

  return null;
}

function usage() {
  console.log('Usage: node send-test-push.js <subscription-file.json> [title] [body]');
  console.log('Example: node send-test-push.js ./subscription.json "Test" "Hello"');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    usage();
    process.exit(0);
  }

  const subFile = args[0];
  const title = args[1] || 'Test Notification';
  const body = args[2] || 'This is a test push message.';

  if (!fs.existsSync(subFile)) {
    console.error('Subscription file not found:', subFile);
    process.exit(2);
  }

  const subJson = JSON.parse(fs.readFileSync(subFile, 'utf8'));

  const vapid = loadVapid();
  if (!vapid || !vapid.publicKey || !vapid.privateKey) {
    console.error('VAPID keys not found. Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY or create backend/.vapid_keys.json');
    process.exit(3);
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const payload = JSON.stringify({ title, body, url: '/' });

  try {
    const result = await webpush.sendNotification(subJson, payload);
    console.log('Push sent, result:', result);
  } catch (err) {
    console.error('Failed to send push:', err && err.body ? err.body : err.message || err);
    process.exit(4);
  }
}

main();

/**
 * One-off script to send a test SMS via Twilio.
 * Run from backend directory: npx tsx scripts/sendTestSms.ts
 */
import { config } from 'dotenv';

config(); // load .env from backend/

const TO_NUMBER = '+923105232553';
const MESSAGE = 'Test from Sourceli – Twilio is working!';

async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.error('Missing Twilio config. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in backend/.env');
    process.exit(1);
  }

  const params = new URLSearchParams();
  params.set('To', TO_NUMBER);
  params.set('From', from);
  params.set('Body', MESSAGE);

  console.log('Sending test SMS to', TO_NUMBER, '...');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error('Twilio error:', res.status, data);
    process.exit(1);
  }

  const data = await res.json();
  console.log('Sent. SID:', data.sid);
}

main();

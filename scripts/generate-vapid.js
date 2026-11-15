// scripts/generate-vapid.js
// Utility script to generate a standard VAPID public/private keypair for Web Push

import webpush from 'web-push';

console.log('Generating fresh VAPID key pair for Maya Web Push...');
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n========================================');
console.log('VAPID KEYS GENERATED SUCCESSFULLY:');
console.log('========================================');
console.log(`VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log('VAPID_SUBJECT="mailto:sirius@axiomsecurecrafts.com"');
console.log('========================================\n');
console.log('Store VAPID_PRIVATE_KEY only on your server (.env / secret manager).');
console.log('The VAPID_PUBLIC_KEY is provided to the client for push subscriptions.\n');

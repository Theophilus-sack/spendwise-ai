const fs = require('fs');
const path = require('path');

// Minimal valid 1x1 green PNG (base64)
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
  'YPj/HwADBgEB/SqVHAAAAA==';

const buf = Buffer.from(pngBase64, 'base64');

const assetsDir = path.join(__dirname, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const files = [
  'icon.png',
  'splash.png',
  'adaptive-icon.png',
  'favicon.png',
  'notification-icon.png',
];

files.forEach((file) => {
  const dest = path.join(assetsDir, file);
  fs.writeFileSync(dest, buf);
  console.log('created', dest);
});

console.log('Done — placeholder assets created.');

// Simple PNG icon generator
const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Dark blue background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);
  
  // White heartbeat/ECG line
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, size / 40);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const centerY = size / 2;
  const padding = size * 0.1;
  
  ctx.beginPath();
  ctx.moveTo(padding, centerY);
  ctx.lineTo(size * 0.25, centerY);
  ctx.lineTo(size * 0.3, centerY - size * 0.2);
  ctx.lineTo(size * 0.35, centerY + size * 0.25);
  ctx.lineTo(size * 0.4, centerY - size * 0.15);
  ctx.lineTo(size * 0.45, centerY);
  ctx.lineTo(size * 0.65, centerY);
  ctx.lineTo(size * 0.7, centerY + size * 0.2);
  ctx.lineTo(size * 0.75, centerY - size * 0.15);
  ctx.lineTo(size * 0.8, centerY);
  ctx.lineTo(size - padding, centerY);
  ctx.stroke();
  
  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`public/${filename}`, buffer);
  console.log(`✅ Generated ${filename} (${size}x${size})`);
}

try {
  generateIcon(180, 'apple-touch-icon.png');
  generateIcon(192, 'icon-192.png');
  generateIcon(512, 'icon-512.png');
  console.log('🎉 All icons generated successfully!');
} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('\n📦 Installing canvas package...');
    require('child_process').execSync('npm install canvas --save-dev', { stdio: 'inherit' });
    console.log('\n🔄 Retrying icon generation...');
    generateIcon(180, 'apple-touch-icon.png');
    generateIcon(192, 'icon-192.png');
    generateIcon(512, 'icon-512.png');
    console.log('🎉 All icons generated successfully!');
  } else {
    throw error;
  }
}

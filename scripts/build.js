const fs = require('fs');
const { execSync } = require('child_process');

const isVercel = process.env.VERCEL === "1";
const apiPath = 'src/app/api';
const tempPath = 'src/api-temp';

if (isVercel) {
  console.log('Building on Vercel - keeping API routes dynamic');
  execSync('next build', { stdio: 'inherit' });
} else {
  try {
    if (fs.existsSync(apiPath)) {
      fs.renameSync(apiPath, tempPath);
      console.log('Moved api folder to temp for static export');
    }
    
    console.log('Running next build for static export...');
    execSync('next build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.renameSync(tempPath, apiPath);
      console.log('Restored api folder');
    }
  }
}

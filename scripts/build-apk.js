const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version || '2.5.0';

console.log(`=== Construyendo Gestor de Gastos v${version} ===`);

execSync('npm run build', { stdio: 'inherit' });
execSync('npx cap sync android', { stdio: 'inherit' });

const androidDir = path.join(__dirname, '..', 'android');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
execSync(`${gradlew} assembleRelease`, { cwd: androidDir, stdio: 'inherit' });

const releaseApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const targetApk = path.join(__dirname, '..', `gestor-de-gastos-v${version}.apk`);

if (!fs.existsSync(releaseApk)) {
  console.error('No se encontró app-release.apk en:', releaseApk);
  process.exit(1);
}

fs.copyFileSync(releaseApk, targetApk);
console.log(`APK generada exitosamente: ${targetApk}`);

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('[MOON LORD APK Packager] Preparing full mobile assets & dashboard...');
const baseDir = path.resolve(__dirname, '..');
const prepareScript = path.join(baseDir, 'prepare_full_apk_dashboard.py');
const buildScript = path.join(__dirname, 'build_moonlord_apk.py');

try {
    console.log('[MOON LORD APK Packager] Step 1: Compiling KeyAuth Core and Assets...');
    execSync(`python "${prepareScript}"`, { stdio: 'inherit', cwd: baseDir });

    console.log('[MOON LORD APK Packager] Step 2: Compiling APK and signing...');
    execSync(`python "${buildScript}"`, { stdio: 'inherit', cwd: __dirname });

    console.log('[MOON LORD APK Packager] COMPLETED SUCCESSFULLY! Deployed to Downloads/MOON-LORD.apk');
} catch (err) {
    console.error('[MOON LORD APK Packager] Build error:', err.message);
    process.exit(1);
}

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const sourceDir = './';
const outputDir = './obfuscated_source';
const exclude = [
    'node_modules',
    'obfuscated_source',
    'DIST_READY',
    '.git',
    'package-lock.json',
    '.gemini',
    'tmp',
    'Selfbot exe',
    'Selfbot exe.rar',
    'Lavalink',
    'Booster With Solver',
    'Token_Formatter',
    'token_checker',
    'token-manager',
    'ffmpeg.exe',
    'token_checker.rar',
    'crash.log',
    'tokens.txt',
    'tokens 2.txt',
    'valid.txt',
    'audios',
    'videos',
    'avatars',
    'build_dist.bat',
    'obfuscate.js',
    'launcher.js'
];

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (exclude.includes(path.basename(src))) return;
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        if (exclude.includes(path.basename(src))) return;
        fs.copyFileSync(src, dest);
    }
}

function obfuscateDirectory(dir) {
    fs.readdirSync(dir).forEach((file) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            obfuscateDirectory(fullPath);
        } else if (file.endsWith('.js') && file !== 'obfuscate.js') {
            console.log(`Obfuscating: ${fullPath}`);
            const code = fs.readFileSync(fullPath, 'utf8');
            const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: false,
                deadCodeInjection: false,
                debugProtection: false,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: false,
                renameGlobals: false,
                selfDefending: false,
                simplify: true,
                splitStrings: false,
                stringArray: false,
                stringArrayEncoding: [],
                stringArrayThreshold: 0,
                unicodeEscapeSequence: false,
                reservedNames: ['require', 'module', 'exports', '__dirname', '__filename', 'getRainlinkPlayers']
            }).getObfuscatedCode();
            fs.writeFileSync(fullPath, obfuscatedCode);
        }
    });
}

// 1. Cleanup & Copy
if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
}
console.log('Copying files to temporary directory...');
copyRecursiveSync(sourceDir, outputDir);

// 2. Obfuscate
console.log('Starting obfuscation...');
obfuscateDirectory(outputDir);

console.log('Obfuscation complete!');

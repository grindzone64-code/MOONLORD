const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'obfuscated_source', 'utils', 'webServer.js');
if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const searchStr = `'/api/message/send'`;
const index = content.indexOf(searchStr);

if (index === -1) {
    console.error('Pattern not found in obfuscated code');
} else {
    console.log('--- FOUND AT INDEX', index, '---');
    console.log(content.substring(index - 100, index + 3500));
}

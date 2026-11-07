// 🛠️ EXE Fix: Define global File and Blob for undici compatibility
if (typeof global.File === 'undefined') {
  const { File, Blob } = require('buffer');
  global.File = File;
  global.Blob = Blob;
}

// 🛠️ EXE Fix: Polyfill String.prototype.toWellFormed for older Node.js runtimes (Node 18)
if (typeof String.prototype.toWellFormed !== 'function') {
  String.prototype.toWellFormed = function () {
    return this.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, (match) => {
      return match.length === 1 ? '\uFFFD' : match;
    });
  };
}

// Explicitly require dependencies so pkg can find them
require('axios');
require('body-parser');
require('cors');
require('debug');
require('discord.js-selfbot-v13');
require('express');
require('libsodium-wrappers');
require('multer');
require('prism-media');
require('rainlink');
require('ws');
require('yt-search');

// Load the protected main script
require('./obfuscated_source/index.js');

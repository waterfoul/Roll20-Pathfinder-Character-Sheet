/* global require */
try {
require('./base');
require('./HLImport');
} catch (e) {
  console.error(e.message, e.stack);
}

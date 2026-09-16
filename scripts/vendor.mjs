import {copyFileSync} from 'node:fs';
copyFileSync('node_modules/jspdf/dist/jspdf.umd.min.js', 'extension/vendor/jspdf.umd.min.js');
copyFileSync('node_modules/jspdf/LICENSE', 'extension/vendor/jspdf.LICENSE');

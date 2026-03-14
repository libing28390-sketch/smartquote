import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups');

const runBackup = () => {
  console.log('[-] Starting pre-build data backup...');

  if (!fs.existsSync(DATA_DIR)) {
    console.warn('! Data directory not found. Skipping backup.');
    return;
  }

  // Create backups directory if not exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
  }

  // Create timestamped folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(BACKUP_DIR, `pre_build_${timestamp}`);
  fs.mkdirSync(targetDir);

  // Copy JSON files
  const files = fs.readdirSync(DATA_DIR);
  let count = 0;
  files.forEach(file => {
    if (file.endsWith('.json')) {
      fs.copyFileSync(path.join(DATA_DIR, file), path.join(targetDir, file));
      count++;
    }
  });

  console.log(`[+] Backup completed: ${count} files saved to ${targetDir}`);
};

runBackup();

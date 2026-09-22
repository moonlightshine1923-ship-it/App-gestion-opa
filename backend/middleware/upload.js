import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..', 'uploads');

function makeStorage(sub) {
  const dir = path.join(ROOT, sub);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
    },
  });
}

export const uploadPhoto = multer({
  storage: makeStorage('photos'),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadDoc = multer({
  storage: makeStorage('documents'),
  limits: { fileSize: 15 * 1024 * 1024 },
});

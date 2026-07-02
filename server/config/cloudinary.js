const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// FAIL LOUD instead of silently falling back to local (ephemeral) disk storage.
// On hosts like Hostinger, the local uploads/ folder gets wiped on every
// restart/redeploy, so a silent fallback here is exactly how files quietly
// go missing. Better to crash on boot with a clear message than to lose files.
if (process.env.FILE_STORAGE === 'cloudinary' && !isCloudinaryConfigured) {
  throw new Error(
    '[cloudinary config] FILE_STORAGE=cloudinary is set but CLOUDINARY_CLOUD_NAME / ' +
    'CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are missing or empty. ' +
    'Fix your environment variables (and restart the server) before continuing — ' +
    'refusing to silently fall back to local disk storage.'
  );
}

const getUploader = () => {
  if (process.env.FILE_STORAGE === 'cloudinary') {
    const storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'toflymedia',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'zip', 'rar', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'txt', 'csv', 'json'],
        resource_type: 'auto',
      },
    });
    return multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
  } else {
    // Local storage
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
      }
    });

    return multer({
      storage,
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|svg|pdf|zip|rar|doc|docx|xls|xlsx|ppt|pptx|mp4|mov|avi|mkv|mp3|wav|txt|csv|json/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext || mime) return cb(null, true);
        cb(new Error('File type not supported'));
      }
    });
  }
};

const getFileUrl = (req, filename) => {
  if (process.env.FILE_STORAGE === 'cloudinary') return filename;
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
};

module.exports = { cloudinary, getUploader, getFileUrl, isCloudinaryConfigured };
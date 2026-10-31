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

// The opposite misconfiguration is just as dangerous and much easier to hit
// by accident: FILE_STORAGE left at the .env.example default of 'local' (or
// unset) on a host like Hostinger, where local disk writes are ephemeral and
// — worse — can fail in ways that hang/reset the connection entirely (the
// browser then reports it as a misleading CORS error, since no response with
// headers ever came back). If Cloudinary creds are present, prefer them
// regardless of FILE_STORAGE. This mirrors what the logo/avatar upload
// routes already do (they're hardcoded to Cloudinary and never break).
const useCloudinary = isCloudinaryConfigured;

if (!useCloudinary) {
  console.warn(
    '[cloudinary config] Cloudinary credentials are not set — falling back to ' +
    'LOCAL disk storage for file uploads. On hosts with an ephemeral or ' +
    'restricted filesystem (e.g. Hostinger), uploads WILL be unreliable or ' +
    'lost on redeploy. Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / ' +
    'CLOUDINARY_API_SECRET to fix this.'
  );
} else if (process.env.FILE_STORAGE !== 'cloudinary') {
  console.warn(
    `[cloudinary config] FILE_STORAGE is set to "${process.env.FILE_STORAGE || '(unset)'}" ` +
    'but valid Cloudinary credentials were found, so Cloudinary is being used ' +
    'anyway (durable storage). Set FILE_STORAGE=cloudinary in your environment ' +
    'variables to make this explicit and silence this warning.'
  );
}

const getUploader = () => {
  if (useCloudinary) {
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
    // Local storage (fallback only — see warning above)
    const uploadDir = process.env.LOCAL_UPLOAD_PATH
      ? path.resolve(__dirname, '..', process.env.LOCAL_UPLOAD_PATH)
      : path.join(__dirname, '..', 'uploads');

    try {
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    } catch (dirErr) {
      console.error(`[cloudinary config] Could not create local upload dir "${uploadDir}":`, dirErr.message);
    }

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        try {
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (e) {
          // Surface as a normal multer error (caught by the route's err
          // callback) instead of throwing and hanging the connection.
          cb(e);
        }
      },
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
  if (useCloudinary) return filename;
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
};

module.exports = { cloudinary, getUploader, getFileUrl, isCloudinaryConfigured, useCloudinary };
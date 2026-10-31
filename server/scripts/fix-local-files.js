/**
 * fix-local-files.js
 *
 * One-off recovery script for the "Route not found" download bug.
 *
 * WHAT HAPPENED:
 *   FILE_STORAGE defaulted to 'local', so files got saved onto this server's
 *   disk (server/uploads/) with a URL baked in like:
 *     https://your-host/uploads/1782802443481-82301658.png
 *   Hosts like Hostinger wipe that folder on every restart/redeploy, so the
 *   database still has the File record, but the actual bytes are gone —
 *   which is why clicking Download hits your own server and gets your own
 *   404 JSON handler ({"success":false,"message":"Route not found"}).
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Finds every File record with storageType 'local'.
 *   2. If the file still physically exists on this server's disk, uploads
 *      it to Cloudinary and updates the DB record to point there (durable
 *      storage, survives restarts).
 *   3. If the file is already gone from disk, it CANNOT be recovered —
 *      the bytes no longer exist anywhere. The script marks that record
 *      `missing: true` so the UI shows "File unavailable" instead of a
 *      dead link, and prints a report at the end so you know exactly
 *      which files someone needs to re-upload manually.
 *
 * USAGE (run from the server/ directory, with your real .env in place):
 *   FILE_STORAGE=cloudinary node scripts/fix-local-files.js
 *
 * Safe to run multiple times.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const File = require('../models/File');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

async function run() {
  if (!isCloudinaryConfigured) {
    console.error(
      '❌ Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / ' +
      'CLOUDINARY_API_SECRET). Set those in your .env before running this script.'
    );
    process.exit(1);
  }

  await connectDB();

  const localFiles = await File.find({ storageType: 'local' });
  console.log(`Found ${localFiles.length} file record(s) marked as local storage.\n`);

  let recovered = 0;
  let alreadyMissing = 0;
  const stillMissing = [];

  for (const file of localFiles) {
    const filename = typeof file.url === 'string' ? file.url.split('/uploads/')[1] : null;
    const localPath = filename ? path.join(UPLOAD_DIR, filename) : null;

    if (localPath && fs.existsSync(localPath)) {
      try {
        const result = await cloudinary.uploader.upload(localPath, {
          folder: 'toflymedia',
          resource_type: 'auto',
        });
        file.url = result.secure_url;
        file.cloudinaryId = result.public_id;
        file.storageType = 'cloudinary';
        file.missing = false;
        await file.save();
        fs.unlinkSync(localPath); // clean up now that it's safely in Cloudinary
        recovered++;
        console.log(`✅ Recovered: ${file.name} (${file._id}) → Cloudinary`);
      } catch (e) {
        console.error(`⚠️  Failed to migrate ${file.name} (${file._id}):`, e.message);
        stillMissing.push(file);
      }
    } else {
      if (!file.missing) {
        file.missing = true;
        await file.save();
      }
      alreadyMissing++;
      stillMissing.push(file);
    }
  }

  console.log('\n──────── Summary ────────');
  console.log(`Recovered to Cloudinary : ${recovered}`);
  console.log(`Unrecoverable (bytes gone): ${alreadyMissing}`);

  if (stillMissing.length) {
    console.log('\nThese files no longer exist anywhere and need to be manually re-uploaded');
    console.log('(use the "Replace" action on the Files page, or delete and re-upload).');
    console.log('Ask whoever originally uploaded them for the original copy:\n');
    stillMissing.forEach(f => {
      console.log(`  - "${f.name}" (id: ${f._id}, client: ${f.client})`);
    });
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
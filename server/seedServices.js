/**
 * seedServices.js  —  run once after deploying the Service model
 *
 * Usage (from project root):
 *   node server/seedServices.js
 *
 * This inserts the original hardcoded SERVICE_LABELS into the new
 * `services` collection. Already-existing keys are skipped (upsert).
 */

const path = require('path');
// Resolves .env from the server/ folder regardless of where you run the command
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const mongoose = require('mongoose');
const Service  = require('./models/Service');

const INITIAL_SERVICES = [
  { key: 'seo',                  label: 'SEO' },
  { key: 'ppc',                  label: 'PPC / Paid Ads' },
  { key: 'social_media',         label: 'Social Media' },
  { key: 'content_marketing',    label: 'Content Marketing' },
  { key: 'email_marketing',      label: 'Email Marketing' },
  { key: 'web_design',           label: 'Web Design' },
  { key: 'analytics',            label: 'Analytics' },
  { key: 'branding',             label: 'Branding' },
  { key: 'video_production',     label: 'Video Production' },
  { key: 'influencer_marketing', label: 'Influencer Marketing' },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let created = 0;
  let skipped = 0;

  for (const s of INITIAL_SERVICES) {
    const result = await Service.updateOne(
      { key: s.key },
      { $setOnInsert: { ...s, isActive: true } },
      { upsert: true }
    );
    if (result.upsertedCount) {
      console.log(`  ✓ Created: ${s.key}`);
      created++;
    } else {
      console.log(`  – Skipped (exists): ${s.key}`);
      skipped++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
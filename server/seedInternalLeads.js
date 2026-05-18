/**
 * seedInternalLeads.js
 *
 * Seeds ONLY internal leads (company's own pipeline).
 * Run AFTER your main seed.js so that User documents already exist.
 *
 * Usage:
 *   node server/seedInternalLeads.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');

const User         = require('./models/User');
const InternalLead = require('./models/InternalLead');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toflymedia');
  console.log('✅ DB Connected');
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const daysAgo      = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow  = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const pick         = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Seed ───────────────────────────────────────────────────────────────────────
const seed = async () => {
  await connectDB();

  // Grab the users we need (created by main seed.js)
  const admin    = await User.findOne({ email: 'admin@toflymedia.com' });
  const marketer = await User.findOne({ email: 'marketer@toflymedia.com' });
  const manager  = await User.findOne({ email: 'manager@toflymedia.com' });

  if (!admin || !marketer) {
    console.error('❌  Admin / marketer users not found. Run seed.js first.');
    process.exit(1);
  }

  // Clear only internal leads — leaves everything else untouched
  await InternalLead.deleteMany({});
  console.log('🗑️  Cleared existing internal leads');

  // ── NEW stage ──────────────────────────────────────────────────────────────
  await InternalLead.create({
    name: 'Arjun Mehta',
    email: 'arjun.mehta@brandwave.in',
    phone: '+91 98100 45231',
    company: 'BrandWave Digital',
    website: 'https://brandwave.in',
    location: 'Mumbai, India',
    source: 'referral',
    sourceDetail: 'Referred by TechNova (client)',
    budget: '₹80k/mo',
    services: ['Meta Ads', 'Google Ads', 'Content Marketing'],
    requirements: 'Wants full-funnel paid media management for their D2C clothing brand. Monthly ad budget around ₹5L.',
    stage: 'new',
    quality: 'hot',
    followUpDate: daysFromNow(1),
    followUpNote: 'First call — understand current setup, traffic, CAC targets.',
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 80000,
    tags: ['d2c', 'fashion', 'high-intent'],
    notes: [],
    activity: [
      { action: 'created', by: admin._id, note: 'Inbound referral from Marcus at TechNova. Very warm.' },
    ],
    createdAt: daysAgo(1),
  });

  await InternalLead.create({
    name: 'Neha Kulkarni',
    email: 'neha@freshroots.co',
    phone: '+91 90040 12345',
    company: 'FreshRoots Organic',
    website: 'https://freshroots.co',
    location: 'Pune, India',
    source: 'instagram',
    sourceDetail: 'DM on @toflymedia Instagram',
    budget: '₹30k/mo',
    services: ['Social Media Management', 'Content Creation'],
    requirements: 'Organic food brand. Needs Instagram + Facebook content + management. No paid ads for now.',
    stage: 'new',
    quality: 'warm',
    followUpDate: daysFromNow(2),
    followUpNote: 'Send intro deck and case studies from similar brands.',
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 30000,
    tags: ['organic', 'fmcg', 'social-only'],
    notes: [],
    activity: [
      { action: 'created', by: marketer._id, note: 'Instagram DM inquiry.' },
    ],
    createdAt: daysAgo(2),
  });

  await InternalLead.create({
    name: 'Vikram Singhania',
    email: 'vikram@singhaniarealty.com',
    phone: '+91 98765 11223',
    company: 'Singhania Realty',
    website: 'https://singhaniarealty.com',
    location: 'Jabalpur, India',
    source: 'cold_outreach',
    sourceDetail: 'LinkedIn cold DM',
    budget: '₹50k/mo',
    services: ['Google Ads', 'Meta Ads', 'SEO'],
    requirements: 'Real estate developer. Wants leads for 2 residential projects launching Q3. Also interested in SEO for new website.',
    stage: 'new',
    quality: 'warm',
    followUpDate: daysFromNow(3),
    followUpNote: 'Confirm which projects to prioritise, share real estate case study (Foster).',
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 50000,
    tags: ['real-estate', 'local', 'jabalpur'],
    notes: [],
    activity: [
      { action: 'created', by: admin._id, note: 'Cold LinkedIn DM. He replied fast — seems interested.' },
    ],
    createdAt: daysAgo(3),
  });

  await InternalLead.create({
    name: 'Simran Kapoor',
    email: 'simran@glowbycosmo.com',
    phone: '+91 98301 77654',
    company: 'Glow by Cosmo',
    website: 'https://glowbycosmo.com',
    location: 'Delhi, India',
    source: 'facebook',
    sourceDetail: 'Facebook Ad — inbound form fill',
    budget: '₹25k/mo',
    services: ['Meta Ads', 'Influencer Marketing'],
    requirements: 'Beauty brand (skincare). Looking for someone to run Meta Ads + source micro-influencers for UGC.',
    stage: 'new',
    quality: 'cold',
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 25000,
    tags: ['beauty', 'influencer', 'meta'],
    notes: [],
    activity: [
      { action: 'created', by: marketer._id, note: 'Form fill from FB ad campaign.' },
    ],
    createdAt: daysAgo(1),
  });

  // ── CONTACTED stage ────────────────────────────────────────────────────────
  await InternalLead.create({
    name: 'Rohit Sharma',
    email: 'rohit@edunexus.io',
    phone: '+91 99887 23456',
    company: 'EduNexus',
    website: 'https://edunexus.io',
    location: 'Bangalore, India',
    source: 'linkedin',
    sourceDetail: 'Organic LinkedIn post comment — asked for DM',
    budget: '₹60k/mo',
    services: ['Google Ads', 'Content Marketing', 'SEO'],
    requirements: 'EdTech platform. Wants student lead generation via Google Ads + content strategy for blog. Has existing team for social.',
    stage: 'contacted',
    quality: 'hot',
    followUpDate: daysFromNow(1),
    followUpNote: 'Follow up on intro call — waiting for them to share GA4 access.',
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 60000,
    tags: ['edtech', 'lead-gen', 'content'],
    notes: [
      {
        body: 'Had a 30-min intro call. Rohit is the decision maker. Very clued in on digital. Currently spending ₹40k/mo with an agency that is not delivering results. We have a real shot here.',
        createdBy: marketer._id,
        createdAt: daysAgo(3),
      },
    ],
    activity: [
      { action: 'created', by: admin._id, note: 'LinkedIn organic inquiry.' },
      { action: 'note_added', by: marketer._id, note: 'First call done.' },
    ],
    createdAt: daysAgo(6),
  });

  await InternalLead.create({
    name: 'Preethi Nair',
    email: 'preethi@hospitalityhub.in',
    phone: '+91 96540 33210',
    company: 'Hospitality Hub India',
    website: 'https://hospitalityhub.in',
    location: 'Kochi, India',
    source: 'referral',
    sourceDetail: 'Referred by Rohit Sharma (EduNexus)',
    budget: '₹45k/mo',
    services: ['Meta Ads', 'Google Ads'],
    requirements: 'Aggregator for boutique hotels. Needs paid ads for bookings (Google + Meta) with seasonal burst campaigns.',
    stage: 'contacted',
    quality: 'warm',
    followUpDate: daysFromNow(2),
    followUpNote: 'Send proposal draft with seasonal campaign structure.',
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 45000,
    tags: ['hospitality', 'b2c', 'seasonal'],
    notes: [
      {
        body: 'Email sent with intro + credentials deck. She replied same day. Good engagement. Setting up a Zoom call this week.',
        createdBy: marketer._id,
        createdAt: daysAgo(2),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Referral from Rohit.' },
      { action: 'note_added', by: marketer._id, note: 'Email exchange, call being scheduled.' },
    ],
    createdAt: daysAgo(5),
  });

  await InternalLead.create({
    name: 'Aditya Joshi',
    email: 'aditya@codeaura.tech',
    phone: '+91 93456 87654',
    company: 'CodeAura Technologies',
    website: 'https://codeaura.tech',
    location: 'Hyderabad, India',
    source: 'website',
    sourceDetail: 'Contact form on toflymedia.com',
    budget: '₹35k/mo',
    services: ['LinkedIn Ads', 'Content Marketing'],
    requirements: 'B2B SaaS startup. Wants LinkedIn Ads to generate qualified leads among CTOs and Engineering VPs in India.',
    stage: 'contacted',
    quality: 'warm',
    followUpDate: daysFromNow(0), // TODAY
    followUpNote: 'Today: send LinkedIn Ads case study + pricing ballpark.',
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 35000,
    tags: ['b2b', 'saas', 'linkedin'],
    notes: [
      {
        body: 'They filled the website form. Short call — he is the founder. Looking for 20 qualified leads/month. Budget is flexible if results come in.',
        createdBy: marketer._id,
        createdAt: daysAgo(4),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Website form fill.' },
      { action: 'note_added', by: marketer._id, note: 'Intro call complete.' },
    ],
    createdAt: daysAgo(7),
  });

  // ── MEETING SCHEDULED stage ────────────────────────────────────────────────
  await InternalLead.create({
    name: 'Kavya Reddy',
    email: 'kavya@luma-jewels.com',
    phone: '+91 98001 55678',
    company: 'Luma Jewels',
    website: 'https://luma-jewels.com',
    location: 'Chennai, India',
    source: 'instagram',
    sourceDetail: 'Story mention — tagged us in a post',
    budget: '₹70k/mo',
    services: ['Meta Ads', 'Google Shopping', 'Social Media Management'],
    requirements: 'Premium jewellery D2C. Wants full ecommerce marketing stack — Meta, Google Shopping, and monthly social media management.',
    stage: 'meeting_scheduled',
    quality: 'hot',
    followUpDate: daysFromNow(1),
    followUpNote: 'Strategy meeting tomorrow 3PM. Prepare ecommerce case studies + ROAS benchmarks.',
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 70000,
    tags: ['jewellery', 'd2c', 'ecommerce', 'high-value'],
    notes: [
      {
        body: 'She reached out after seeing our Bloom & Co case study post. Very interested in the full package. Meeting confirmed for tomorrow.',
        createdBy: marketer._id,
        createdAt: daysAgo(3),
      },
      {
        body: 'She has an in-house designer but no dedicated marketer. We could be her entire marketing function. Big opportunity.',
        createdBy: admin._id,
        createdAt: daysAgo(2),
      },
    ],
    activity: [
      { action: 'created', by: admin._id, note: 'Instagram story inquiry.' },
      { action: 'note_added', by: marketer._id, note: 'Qualification call done.' },
      { action: 'note_added', by: admin._id, note: 'Meeting booked.' },
    ],
    createdAt: daysAgo(8),
  });

  await InternalLead.create({
    name: 'Sandeep Rathore',
    email: 'sandeep@fitpeak.in',
    phone: '+91 90000 34521',
    company: 'FitPeak Nutrition',
    website: 'https://fitpeak.in',
    location: 'Indore, India',
    source: 'cold_outreach',
    sourceDetail: 'Cold email outreach campaign',
    budget: '₹55k/mo',
    services: ['Meta Ads', 'Influencer Marketing', 'Content Creation'],
    requirements: 'Sports nutrition brand. Wants to aggressively grow via influencer marketing + paid ads on Meta. Target: fitness community.',
    stage: 'meeting_scheduled',
    quality: 'warm',
    followUpDate: daysFromNow(3),
    followUpNote: 'Meeting in 3 days — prepare influencer marketing deck with fitness niche case studies.',
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 55000,
    tags: ['fitness', 'nutrition', 'd2c', 'influencer'],
    notes: [
      {
        body: 'Cold email response after 2 follow-ups. He is the co-founder. Budget might scale if results are good — they just closed a seed round.',
        createdBy: marketer._id,
        createdAt: daysAgo(5),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Cold email campaign response.' },
      { action: 'note_added', by: marketer._id, note: 'Seed funding confirmed — good signal.' },
    ],
    createdAt: daysAgo(10),
  });

  // ── PROPOSAL SENT stage ────────────────────────────────────────────────────
  await InternalLead.create({
    name: 'Nisha Chandra',
    email: 'nisha@clinicaboard.com',
    phone: '+91 98220 67890',
    company: 'Clinica Board',
    website: 'https://clinicaboard.com',
    location: 'Nagpur, India',
    source: 'referral',
    sourceDetail: 'Referred by team contact at a networking event',
    budget: '₹90k/mo',
    services: ['Google Ads', 'SEO', 'Content Marketing', 'Meta Ads'],
    requirements: 'Healthcare platform connecting patients with specialist doctors. Needs aggressive lead gen + SEO for organic dominance.',
    stage: 'proposal_sent',
    quality: 'hot',
    followUpDate: daysFromNow(2),
    followUpNote: 'Follow up on proposal — ask for feedback and offer to jump on a Q&A call.',
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 90000,
    tags: ['healthcare', 'high-value', 'seo', 'lead-gen'],
    notes: [
      {
        body: 'Full proposal sent — 3-page scope including paid ads + SEO roadmap + content plan. Pricing: ₹90k/mo on a 6-month retainer.',
        createdBy: marketer._id,
        createdAt: daysAgo(4),
      },
      {
        body: 'She opened the proposal 3 times (we tracked with Notion). Clear intent. Likely deciding between us and one other agency.',
        createdBy: admin._id,
        createdAt: daysAgo(2),
      },
    ],
    activity: [
      { action: 'created', by: admin._id, note: 'Networking referral.' },
      { action: 'note_added', by: marketer._id, note: 'Strategy meeting done, proposal sent.' },
    ],
    createdAt: daysAgo(14),
  });

  await InternalLead.create({
    name: 'Tarun Bhatia',
    email: 'tarun@rapidkart.co',
    phone: '+91 97700 22334',
    company: 'RapidKart',
    website: 'https://rapidkart.co',
    location: 'Gurgaon, India',
    source: 'linkedin',
    sourceDetail: 'LinkedIn Ad — our own campaign',
    budget: '₹1.2L/mo',
    services: ['Performance Marketing', 'Google Ads', 'Meta Ads', 'Analytics Setup'],
    requirements: 'Quick commerce startup. Wants full performance marketing setup — Google, Meta, analytics, attribution. High budget.',
    stage: 'proposal_sent',
    quality: 'hot',
    followUpDate: daysFromNow(0), // TODAY
    followUpNote: 'TODAY — final follow up on proposal before they go with another agency. Be assertive.',
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 120000,
    tags: ['startup', 'quick-commerce', 'high-budget', 'urgent'],
    notes: [
      {
        body: 'This is a big one. ₹1.2L/mo retainer. They have VC funding. If we close this it is our biggest deal.',
        createdBy: admin._id,
        createdAt: daysAgo(7),
      },
      {
        body: 'Proposal was detailed — 15-page doc with attribution model, creative strategy, and 90-day plan. They loved the meeting. Waiting on legal/sign-off.',
        createdBy: marketer._id,
        createdAt: daysAgo(5),
      },
      {
        body: 'Tarun mentioned another agency is in the running. We need to follow up today — no delays.',
        createdBy: admin._id,
        createdAt: daysAgo(1),
      },
    ],
    activity: [
      { action: 'created', by: admin._id, note: 'LinkedIn Ad lead — very strong profile.' },
      { action: 'note_added', by: marketer._id, note: 'Proposal sent.' },
      { action: 'note_added', by: admin._id, note: 'Competitor in the mix — urgent follow-up required.' },
    ],
    createdAt: daysAgo(18),
  });

  // ── NEGOTIATION stage ──────────────────────────────────────────────────────
  await InternalLead.create({
    name: 'Deepika Iyer',
    email: 'deepika@solarlux.in',
    phone: '+91 96000 11234',
    company: 'SolarLux Energy',
    website: 'https://solarlux.in',
    location: 'Pune, India',
    source: 'website',
    sourceDetail: 'SEO inbound — blog article on solar marketing',
    budget: '₹65k/mo',
    services: ['Google Ads', 'SEO', 'Landing Page Optimization'],
    requirements: 'Residential solar panel company. Strong organic inquiry. Wants Google Ads for paid + SEO for organic leads across Maharashtra.',
    stage: 'negotiation',
    quality: 'hot',
    followUpDate: daysFromNow(1),
    followUpNote: 'They want 10% off on a 12-month deal — check with Alex if that is possible.',
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 65000,
    tags: ['solar', 'local', 'seo', 'negotiation'],
    notes: [
      {
        body: 'They loved the proposal. Asked for a 10% discount on a 12-month commitment. Internally we are fine with 7%. Need to find the middle ground.',
        createdBy: admin._id,
        createdAt: daysAgo(3),
      },
      {
        body: 'Counter proposed: 8% off + free analytics dashboard setup (value ₹15k). Waiting on their response.',
        createdBy: marketer._id,
        createdAt: daysAgo(1),
      },
    ],
    activity: [
      { action: 'created', by: admin._id, note: 'SEO inbound, strong intent.' },
      { action: 'moved', fromStage: 'proposal_sent', toStage: 'negotiation', by: marketer._id, note: 'Proposal accepted in principle, now on pricing.' },
    ],
    createdAt: daysAgo(20),
  });

  await InternalLead.create({
    name: 'Gaurav Malhotra',
    email: 'gaurav@neonfit.in',
    phone: '+91 99111 45678',
    company: 'NeonFit Gyms',
    website: 'https://neonfit.in',
    location: 'Delhi NCR, India',
    source: 'referral',
    sourceDetail: 'Referred by FitPeak (existing lead)',
    budget: '₹50k/mo',
    services: ['Meta Ads', 'Google Ads', 'WhatsApp Marketing'],
    requirements: 'Chain of premium gyms. 7 locations. Wants hyperlocal Meta + Google Ads for membership drive + WhatsApp drip campaigns.',
    stage: 'negotiation',
    quality: 'hot',
    followUpDate: daysFromNow(2),
    followUpNote: 'Finalise contract structure — they want per-location billing breakdown in the agreement.',
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 50000,
    tags: ['fitness', 'hyperlocal', 'multi-location', 'whatsapp'],
    notes: [
      {
        body: 'Almost there. Main sticking point is the invoicing — they want a separate PO per gym location. We can accommodate that.',
        createdBy: marketer._id,
        createdAt: daysAgo(2),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Referral from FitPeak lead.' },
      { action: 'moved', fromStage: 'proposal_sent', toStage: 'negotiation', by: marketer._id, note: 'In final stages.' },
    ],
    createdAt: daysAgo(22),
  });

  // ── WON stage ─────────────────────────────────────────────────────────────
  await InternalLead.create({
    name: 'Meghna Sood',
    email: 'meghna@drapeeco.com',
    phone: '+91 98500 99887',
    company: 'Drape & Co',
    website: 'https://drapeeco.com',
    location: 'Jaipur, India',
    source: 'instagram',
    sourceDetail: 'DM after seeing our Instagram Reel on D2C fashion case study',
    budget: '₹55k/mo',
    services: ['Meta Ads', 'Google Shopping', 'Social Media Management'],
    requirements: 'Sustainable fashion D2C brand. Full ecommerce marketing — paid + social.',
    stage: 'won',
    quality: 'hot',
    followUpDate: null,
    assignedTo: marketer._id,
    createdBy: admin._id,
    dealValue: 55000,
    closedReason: 'Signed 6-month retainer at ₹55k/mo. Onboarding starts next Monday.',
    tags: ['fashion', 'd2c', 'sustainable', 'won'],
    notes: [
      {
        body: 'They signed! 🎉 6-month retainer. Onboarding call scheduled for Monday. Priya to lead, Alex to join for the first session.',
        createdBy: admin._id,
        createdAt: daysAgo(2),
      },
    ],
    activity: [
      { action: 'created', by: admin._id, note: 'Instagram DM.' },
      { action: 'moved', fromStage: 'negotiation', toStage: 'won', by: admin._id, note: 'Contract signed!' },
    ],
    createdAt: daysAgo(25),
  });

  await InternalLead.create({
    name: 'Rahul Aggarwal',
    email: 'rahul@nxtlogistics.com',
    phone: '+91 93001 34567',
    company: 'NXT Logistics',
    website: 'https://nxtlogistics.com',
    location: 'Indore, India',
    source: 'cold_outreach',
    sourceDetail: 'Cold email',
    budget: '₹40k/mo',
    services: ['Google Ads', 'LinkedIn Ads'],
    requirements: 'B2B logistics company. Lead generation for enterprise clients via Google + LinkedIn.',
    stage: 'won',
    quality: 'warm',
    followUpDate: null,
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 40000,
    closedReason: 'Signed 3-month trial retainer at ₹40k/mo. Option to extend at ₹50k.',
    tags: ['b2b', 'logistics', 'won'],
    notes: [
      {
        body: '3-month trial deal closed. If we deliver 20+ qualified leads in month 1 they will commit to a longer contract. Good long-term potential.',
        createdBy: marketer._id,
        createdAt: daysAgo(5),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Cold email.' },
      { action: 'moved', fromStage: 'proposal_sent', toStage: 'won', by: marketer._id, note: 'Trial deal signed.' },
    ],
    createdAt: daysAgo(30),
  });

  await InternalLead.create({
    name: 'Pooja Desai',
    email: 'pooja@babyblossom.in',
    phone: '+91 97890 23456',
    company: 'Baby Blossom',
    website: 'https://babyblossom.in',
    location: 'Ahmedabad, India',
    source: 'facebook',
    sourceDetail: 'Facebook Ad comment — asked for DM',
    budget: '₹35k/mo',
    services: ['Meta Ads', 'Content Creation'],
    requirements: 'Mother & baby products brand. Meta Ads + monthly content creation package.',
    stage: 'won',
    quality: 'warm',
    followUpDate: null,
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 35000,
    closedReason: 'Month-to-month retainer. ₹35k/mo. Easy onboarding — small scope.',
    tags: ['baby', 'd2c', 'won', 'easy-onboard'],
    notes: [
      {
        body: 'Quick close — 10 days from first DM to signed agreement. She is decisive and very clear on what she wants. Should be a smooth client.',
        createdBy: marketer._id,
        createdAt: daysAgo(8),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Facebook Ad inquiry.' },
      { action: 'moved', fromStage: 'contacted', toStage: 'won', by: marketer._id, note: 'Moved fast — signed within 10 days.' },
    ],
    createdAt: daysAgo(28),
  });

  // ── LOST stage ─────────────────────────────────────────────────────────────
  await InternalLead.create({
    name: 'Suresh Pillai',
    email: 'suresh@trendwear.in',
    phone: '+91 94400 98765',
    company: 'TrendWear India',
    website: 'https://trendwear.in',
    location: 'Coimbatore, India',
    source: 'referral',
    budget: '₹45k/mo',
    services: ['Meta Ads', 'Influencer Marketing'],
    requirements: 'Fast fashion brand. Wanted heavy influencer outreach + Meta ads.',
    stage: 'lost',
    quality: 'warm',
    followUpDate: daysFromNow(90),
    followUpNote: 'Revisit in Q4 — they might be looking again after Diwali season.',
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 45000,
    closedReason: 'Went with a cheaper agency. Price was the main objection. Not willing to match. Possible revisit in Q4.',
    tags: ['fashion', 'lost', 'price-sensitive', 'revisit-q4'],
    notes: [
      {
        body: 'Lost on price. A local agency quoted ₹20k for similar scope. We did not match — our pricing is justified by the quality. Noted for revisit in Q4.',
        createdBy: marketer._id,
        createdAt: daysAgo(10),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Referral lead.' },
      { action: 'moved', fromStage: 'proposal_sent', toStage: 'lost', by: marketer._id, note: 'Lost on price to local agency.' },
    ],
    createdAt: daysAgo(35),
  });

  await InternalLead.create({
    name: 'Kavita Menon',
    email: 'kavita@menon-exports.com',
    phone: '+91 91100 55432',
    company: 'Menon Exports',
    website: 'https://menon-exports.com',
    location: 'Cochin, India',
    source: 'website',
    budget: '₹30k/mo',
    services: ['Google Ads', 'SEO'],
    requirements: 'B2B export house. Wanted Google Ads + SEO for international B2B buyers.',
    stage: 'lost',
    quality: 'cold',
    followUpDate: null,
    assignedTo: marketer._id,
    createdBy: marketer._id,
    dealValue: 30000,
    closedReason: 'No decision — internal team decided to pause marketing investments for 6 months. No budget approved.',
    tags: ['b2b', 'exports', 'lost', 'no-budget'],
    notes: [
      {
        body: 'They paused all vendor engagements due to internal restructuring. Not a reflection of our pitch. May come back next financial year.',
        createdBy: marketer._id,
        createdAt: daysAgo(15),
      },
    ],
    activity: [
      { action: 'created', by: marketer._id, note: 'Website form fill.' },
      { action: 'moved', fromStage: 'contacted', toStage: 'lost', by: marketer._id, note: 'Budget freeze internally.' },
    ],
    createdAt: daysAgo(40),
  });

  console.log('');
  console.log('✅ Internal leads seeded successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 INTERNAL LEADS SUMMARY:');
  console.log('  🆕 New           : 4 leads  (Arjun, Neha, Vikram, Simran)');
  console.log('  📞 Contacted     : 3 leads  (Rohit, Preethi, Aditya)');
  console.log('  📅 Mtg Scheduled : 2 leads  (Kavya, Sandeep)');
  console.log('  📄 Proposal Sent : 2 leads  (Nisha, Tarun ← follow up TODAY)');
  console.log('  🤝 Negotiation   : 2 leads  (Deepika, Gaurav)');
  console.log('  🏆 Won           : 3 leads  (Meghna, Rahul, Pooja)');
  console.log('  ❌ Lost          : 2 leads  (Suresh, Kavita)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚡ Follow up TODAY: Aditya (CodeAura) + Tarun (RapidKart)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
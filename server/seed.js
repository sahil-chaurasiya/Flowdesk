require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const User = require('./models/User');
const Client = require('./models/Client');
const Task = require('./models/Task');
const Update = require('./models/Update');
const Report = require('./models/Report');
const File = require('./models/File');
const Lead = require('./models/Lead');
const { Conversation, Message } = require('./models/Message');
const { SocialAccount, SocialPost } = require('./models/SocialPost');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/toflymedia');
  console.log('✅ DB Connected for seeding');
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Fake but realistic Cloudinary-style image URLs
const PLACEHOLDER_IMAGES = {
  product: [
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800',
    'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=800',
    'https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=800',
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800',
  ],
  lifestyle: [
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800',
    'https://images.unsplash.com/photo-1512361436605-a484bdb34b5f?w=800',
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800',
  ],
  tech: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800',
  ],
  realestate: [
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
    'https://images.unsplash.com/photo-1582407947304-fd86f28f8c58?w=800',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
  ],
};

// ── Seed ───────────────────────────────────────────────────────────────────────

const seed = async () => {
  await connectDB();

  // Clear everything
  await Promise.all([
    User.deleteMany({}), Client.deleteMany({}), Task.deleteMany({}),
    Update.deleteMany({}), Report.deleteMany({}), File.deleteMany({}),
    Conversation.deleteMany({}), Message.deleteMany({}),
    Lead.deleteMany({}), SocialAccount.deleteMany({}), SocialPost.deleteMany({})
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Team Users ─────────────────────────────────────────────────────────────

  const adminUser = await User.create({
    name: 'Alex Reynolds', email: 'admin@toflymedia.com', password: 'Admin123!',
    role: 'admin', jobTitle: 'CEO & Founder', department: 'Executive', isActive: true
  });
  const managerUser = await User.create({
    name: 'Sarah Mitchell', email: 'manager@toflymedia.com', password: 'Manager123!',
    role: 'manager', jobTitle: 'Project Manager', department: 'Operations', isActive: true
  });
  const marketerUser = await User.create({
    name: 'Priya Sharma', email: 'marketer@toflymedia.com', password: 'Marketer123!',
    role: 'performance_marketer', jobTitle: 'Performance Marketer', department: 'Growth', isActive: true
  });
  const socialUser = await User.create({
    name: 'Dani Cruz', email: 'social@toflymedia.com', password: 'Social123!',
    role: 'social_media_manager', jobTitle: 'Social Media Manager', department: 'Content', isActive: true
  });
  const editorUser = await User.create({
    name: 'Jake Torres', email: 'editor@toflymedia.com', password: 'Editor123!',
    role: 'video_editor', jobTitle: 'Video Editor', department: 'Creative', isActive: true
  });
  const designerUser = await User.create({
    name: 'Mia Patel', email: 'designer@toflymedia.com', password: 'Designer123!',
    role: 'graphic_designer', jobTitle: 'Graphic Designer', department: 'Creative', isActive: true
  });
  const copywriterUser = await User.create({
    name: 'Leo Nakamura', email: 'copy@toflymedia.com', password: 'Copy123!',
    role: 'copywriter', jobTitle: 'Copywriter', department: 'Content', isActive: true
  });
  console.log('👥 Team users created');

  // ── Clients ────────────────────────────────────────────────────────────────

  const client1 = await Client.create({
    name: 'Marcus Webb', company: 'TechNova Solutions', email: 'marcus@technova.com',
    phone: '+1 (555) 234-5678', website: 'https://technova.com', industry: 'SaaS / Technology',
    status: 'active', plan: 'enterprise',
    services: ['ppc', 'seo', 'social_media', 'content_marketing'],
    accountManager: managerUser._id,
    teamMembers: [marketerUser._id, socialUser._id, designerUser._id, copywriterUser._id],
    startDate: new Date('2024-01-15'), monthlyBudget: 15000, currency: 'USD',
    notes: 'High-priority enterprise client. Monthly review calls scheduled.',
    tags: ['enterprise', 'saas', 'high-value'], onboardingCompleted: true
  });

  const client2 = await Client.create({
    name: 'Diana Chen', company: 'Bloom & Co Beauty', email: 'diana@bloomco.com',
    phone: '+1 (555) 876-5432', website: 'https://bloomco.com', industry: 'Beauty & Cosmetics',
    status: 'active', plan: 'growth',
    services: ['social_media', 'influencer_marketing', 'content_marketing', 'video_production'],
    accountManager: managerUser._id,
    teamMembers: [socialUser._id, editorUser._id, designerUser._id],
    startDate: new Date('2024-03-01'), monthlyBudget: 8000, currency: 'USD',
    tags: ['beauty', 'ecommerce', 'social-first'], onboardingCompleted: true
  });

  const client3 = await Client.create({
    name: 'Ryan Foster', company: 'Foster Real Estate Group', email: 'ryan@fosterrealty.com',
    phone: '+1 (555) 345-6789', website: 'https://fosterrealty.com', industry: 'Real Estate',
    status: 'onboarding', plan: 'professional', services: ['ppc', 'seo'],
    accountManager: adminUser._id, teamMembers: [marketerUser._id],
    startDate: new Date('2024-06-01'), monthlyBudget: 5000, currency: 'USD',
    tags: ['real-estate', 'local', 'leads'], onboardingCompleted: false
  });

  console.log('🏢 Clients created');

  // ── Client Portal Users ────────────────────────────────────────────────────

  const clientUser1 = await User.create({
    name: 'Marcus Webb', email: 'client@toflymedia.com', password: 'Client123!',
    role: 'client', clientId: client1._id, isActive: true
  });
  const clientUser2 = await User.create({
    name: 'Diana Chen', email: 'diana.client@toflymedia.com', password: 'Client123!',
    role: 'client', clientId: client2._id, isActive: true
  });
  const clientUser3 = await User.create({
    name: 'Ryan Foster', email: 'ryan.client@toflymedia.com', password: 'Client123!',
    role: 'client', clientId: client3._id, isActive: true
  });

  await Client.findByIdAndUpdate(client1._id, { linkedUserId: clientUser1._id });
  await Client.findByIdAndUpdate(client2._id, { linkedUserId: clientUser2._id });
  await Client.findByIdAndUpdate(client3._id, { linkedUserId: clientUser3._id });

  console.log('🔐 Client portal users created');

  // ── Social Accounts ────────────────────────────────────────────────────────

  // TechNova — LinkedIn + Twitter + Instagram (B2B)
  const tn_linkedin = await SocialAccount.create({
    client: client1._id, platform: 'linkedin',
    accountName: 'TechNova Solutions', accountUrl: 'https://linkedin.com/company/technova-solutions',
    followers: 12400, followersChange: 320, isActive: true
  });
  const tn_twitter = await SocialAccount.create({
    client: client1._id, platform: 'twitter',
    accountName: '@TechNovaHQ', accountUrl: 'https://twitter.com/TechNovaHQ',
    followers: 8750, followersChange: 145, isActive: true
  });
  const tn_instagram = await SocialAccount.create({
    client: client1._id, platform: 'instagram',
    accountName: '@technova.solutions', accountUrl: 'https://instagram.com/technova.solutions',
    followers: 5200, followersChange: 210, isActive: true
  });

  // Bloom & Co — Instagram + TikTok + Facebook (B2C Beauty)
  const bl_instagram = await SocialAccount.create({
    client: client2._id, platform: 'instagram',
    accountName: '@bloomandco.beauty', accountUrl: 'https://instagram.com/bloomandco.beauty',
    followers: 48600, followersChange: 1840, isActive: true
  });
  const bl_tiktok = await SocialAccount.create({
    client: client2._id, platform: 'tiktok',
    accountName: '@bloomandco', accountUrl: 'https://tiktok.com/@bloomandco',
    followers: 32100, followersChange: 4200, isActive: true
  });
  const bl_facebook = await SocialAccount.create({
    client: client2._id, platform: 'facebook',
    accountName: 'Bloom & Co Beauty', accountUrl: 'https://facebook.com/bloomandcobeauty',
    followers: 18900, followersChange: 280, isActive: true
  });

  // Foster Real Estate — Instagram + Facebook
  const fr_instagram = await SocialAccount.create({
    client: client3._id, platform: 'instagram',
    accountName: '@fosterrealtygroup', accountUrl: 'https://instagram.com/fosterrealtygroup',
    followers: 3200, followersChange: 85, isActive: true
  });
  const fr_facebook = await SocialAccount.create({
    client: client3._id, platform: 'facebook',
    accountName: 'Foster Real Estate Group', accountUrl: 'https://facebook.com/fosterrealtygroup',
    followers: 5400, followersChange: 60, isActive: true
  });

  console.log('📱 Social accounts created');

  // ── Social Posts — TechNova (LinkedIn heavy, B2B tone) ─────────────────────

  const technovaLinkedInCaptions = [
    { caption: "We just crossed 10,000 customers — and we're just getting started 🚀\n\nFrom bootstrapped to enterprise-grade, here's what we learned about scaling a SaaS product in a competitive market. Thread 🧵👇\n\n#SaaS #Growth #TechNova #Startup", hashtags: ['SaaS', 'Growth', 'TechNova', 'Startup'] },
    { caption: "Most companies get automation wrong.\n\nThey automate tasks. We automate decisions.\n\nTechNova's new AI workflow engine reduces manual review time by 73%. See how it works 👇\n\n#Automation #AI #ProductLaunch #SaaS", hashtags: ['Automation', 'AI', 'ProductLaunch', 'SaaS'] },
    { caption: "Case Study: How a $2M ARR company doubled their team productivity without hiring a single person.\n\nFull story in the link below. 📈\n\n#CaseStudy #Productivity #SaaS #TechNova", hashtags: ['CaseStudy', 'Productivity', 'SaaS'] },
    { caption: "The future of B2B software isn't about features. It's about removing friction.\n\nEvery click we eliminate is a customer retained.\n\nWhat's the one friction point you wish your current tools would fix?\n\n#UX #B2BSaaS #ProductThinking", hashtags: ['UX', 'B2BSaaS', 'ProductThinking'] },
    { caption: "We're hiring! 🌟\n\nLooking for a Senior Product Designer who thinks in systems, not screens.\n\nRemote-first. Competitive equity. Real ownership.\n\nTag someone who should apply 👇\n\n#Hiring #ProductDesign #RemoteWork #TechNova", hashtags: ['Hiring', 'ProductDesign', 'RemoteWork'] },
    { caption: "Hot take: Your CRM shouldn't require training.\n\nIf your team needs a 2-hour onboarding to use a tool, the tool is the problem.\n\nTechNova was built for the person who doesn't have time to read documentation.\n\n#CRM #SaaS #Simplicity #B2B", hashtags: ['CRM', 'SaaS', 'Simplicity', 'B2B'] },
    { caption: "Q2 was big for us. Here's a snapshot:\n\n✅ 47% increase in enterprise sign-ups\n✅ NPS score: 72 (industry avg: 34)\n✅ Launched 3 major integrations\n✅ Expanded to APAC markets\n\nQ3, we're coming for you. 🔥\n\n#Milestone #SaaS #Growth", hashtags: ['Milestone', 'SaaS', 'Growth'] },
    { caption: "Integrations aren't a feature — they're a strategy.\n\nToday we launched our Salesforce + HubSpot two-way sync. Every deal, every note, every contact — in perfect harmony.\n\n#Integration #Salesforce #HubSpot #TechNova", hashtags: ['Integration', 'Salesforce', 'HubSpot'] },
  ];

  const technovaTwitterCaptions = [
    { caption: "the best SaaS products don't sell features\n\nthey sell fewer headaches\n\n#SaaS #B2B", hashtags: ['SaaS', 'B2B'] },
    { caption: "we A/B tested 4 onboarding flows last quarter\n\nthe shortest one won. by a lot.\n\nless is more.\n\n#ProductDesign #SaaS #Onboarding", hashtags: ['ProductDesign', 'SaaS', 'Onboarding'] },
    { caption: "Reminder: churn is a product problem disguised as a sales problem.\n\n#SaaS #Retention #ProductLed", hashtags: ['SaaS', 'Retention', 'ProductLed'] },
    { caption: "TechNova + Zapier is live ⚡\n\n2,000+ automations now possible without writing a single line of code.\n\n#NoCode #Zapier #Automation", hashtags: ['NoCode', 'Zapier', 'Automation'] },
    { caption: "Cold truth: most companies don't have a data problem.\n\nThey have a data access problem.\n\nWe fixed that.\n\n#DataOps #B2BSaaS #TechNova", hashtags: ['DataOps', 'B2BSaaS'] },
    { caption: "New blog: '7 reasons your sales team isn't using your CRM (and how to fix it)'\n\nLink in bio 🔗\n\n#CRM #SalesOps #B2B", hashtags: ['CRM', 'SalesOps', 'B2B'] },
  ];

  const tnLinkedInPosts = [];
  for (let i = 0; i < technovaLinkedInCaptions.length; i++) {
    const daysBack = (i + 1) * 3;  // max 24 days back
    const publishedAt = daysAgo(daysBack);
    const reach = rand(3200, 18000);
    const likes = rand(120, 980);
    const comments = rand(18, 120);
    const shares = rand(15, 80);
    const post = await SocialPost.create({
      client: client1._id,
      socialAccount: tn_linkedin._id,
      platform: 'linkedin',
      contentType: 'post',
      caption: technovaLinkedInCaptions[i].caption,
      hashtags: technovaLinkedInCaptions[i].hashtags,
      mediaUrls: [pick(PLACEHOLDER_IMAGES.tech)],
      status: 'published',
      publishedAt,
      scheduledAt: new Date(publishedAt.getTime() - 30 * 60 * 1000),
      createdBy: socialUser._id,
      assignedTo: copywriterUser._id,
      approvedBy: managerUser._id,
      publishedBy: socialUser._id,
      metrics: { likes, comments, shares, saves: rand(40, 200), views: rand(5000, 30000), reach, impressions: Math.floor(reach * 1.3), clicks: rand(80, 600), profileVisits: rand(50, 400), engagementRate: parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) },
      isClientVisible: true
    });
    tnLinkedInPosts.push(post);
  }

  const tnTwitterPosts = [];
  for (let i = 0; i < technovaTwitterCaptions.length; i++) {
    const daysBack = (i + 1) * 4;  // max 24 days back
    const publishedAt = daysAgo(daysBack);
    const reach = rand(800, 6000);
    const likes = rand(40, 420);
    const comments = rand(5, 60);
    const shares = rand(10, 80);
    const post = await SocialPost.create({
      client: client1._id,
      socialAccount: tn_twitter._id,
      platform: 'twitter',
      contentType: 'post',
      caption: technovaTwitterCaptions[i].caption,
      hashtags: technovaTwitterCaptions[i].hashtags,
      status: 'published',
      publishedAt,
      scheduledAt: new Date(publishedAt.getTime() - 30 * 60 * 1000),
      createdBy: copywriterUser._id,
      assignedTo: copywriterUser._id,
      approvedBy: socialUser._id,
      publishedBy: socialUser._id,
      metrics: { likes, comments, shares, views: rand(1000, 9000), reach, impressions: Math.floor(reach * 1.5), clicks: rand(20, 200), engagementRate: parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) },
      isClientVisible: true
    });
    tnTwitterPosts.push(post);
  }

  // TechNova scheduled/draft posts
  await SocialPost.create({
    client: client1._id, socialAccount: tn_linkedin._id, platform: 'linkedin',
    contentType: 'carousel',
    caption: "5 signs your team has outgrown your current CRM 📊\n\nSwipe to see if it's time to upgrade.\n\n#CRM #SaaS #B2B #TechNova",
    hashtags: ['CRM', 'SaaS', 'B2B', 'TechNova'],
    mediaUrls: PLACEHOLDER_IMAGES.tech.slice(0, 3),
    status: 'scheduled',
    scheduledAt: daysFromNow(2),
    createdBy: copywriterUser._id,
    assignedTo: designerUser._id,
    approvedBy: managerUser._id,
    isClientVisible: true
  });
  await SocialPost.create({
    client: client1._id, socialAccount: tn_twitter._id, platform: 'twitter',
    contentType: 'post',
    caption: "Exciting product update dropping this week 👀\n\nStay tuned.\n\n#TechNova #ProductUpdate",
    hashtags: ['TechNova', 'ProductUpdate'],
    status: 'draft',
    createdBy: copywriterUser._id,
    assignedTo: copywriterUser._id,
    isClientVisible: false,
    notes: 'Needs approval before scheduling. Coordinate with product team on launch date.'
  });
  await SocialPost.create({
    client: client1._id, socialAccount: tn_instagram._id, platform: 'instagram',
    contentType: 'reel',
    caption: "What does a day in the life of a TechNova engineer look like? 💻\n\nSpoiler: it involves a lot of coffee and zero boring meetings. ☕\n\n#DayInTheLife #TechCulture #Engineering #TechNova",
    hashtags: ['DayInTheLife', 'TechCulture', 'Engineering', 'TechNova'],
    mediaUrls: [pick(PLACEHOLDER_IMAGES.tech)],
    status: 'scheduled',
    scheduledAt: daysFromNow(4),
    createdBy: socialUser._id,
    assignedTo: editorUser._id,
    isClientVisible: true
  });

  console.log('  ↳ TechNova social posts done');

  // ── Social Posts — Bloom & Co (Instagram + TikTok, beauty/lifestyle) ────────

  const bloomInstagramPosts = [
    { caption: "Your summer skin doesn't have to choose between glow and protection ☀️✨\n\nOur SPF-infused Glow Serum is back — now with 30% more coverage and the same skin-loving formula you already love 💛\n\nLink in bio to shop.\n\n#GlowSerum #SkincareTok #SummerSkincare #BloomAndCo #SPF #GlowUp", hashtags: ['GlowSerum', 'SkincareTok', 'SummerSkincare', 'BloomAndCo', 'SPF', 'GlowUp'], type: 'post' },
    { caption: "POV: you finally found your holy grail moisturiser 🙌\n\nThe Bloom Hydra-Burst Cream went viral for a reason. 48-hour hydration, no greasiness, instantly absorbed. \n\nComment 'GLOW' and we'll DM you a 20% off code 💌\n\n#HydraBoost #MoistureBarrier #SkincareCommunity #BloomAndCo", hashtags: ['HydraBoost', 'MoistureBarrier', 'SkincareCommunity', 'BloomAndCo'], type: 'post' },
    { caption: "Shade range just dropped 👀🎨\n\n12 new shades of our bestselling Velvet Lip Tint — from nude nudes to berry boldness.\n\nWhich shade are you? Drop a number below 👇\n\n#LipTint #LipstickSwatches #BloomMakeup #BloomAndCo #MakeupTok", hashtags: ['LipTint', 'LipstickSwatches', 'BloomMakeup', 'BloomAndCo', 'MakeupTok'], type: 'carousel' },
    { caption: "She used our Vitamin C Brightening Serum for 30 days. Here's what happened 👇\n\n@sarahlooks shared her before & after and we are OBSESSED 😍\n\nTag us in your #BloomGlow results for a chance to be featured!\n\n#BeforeAndAfter #VitaminC #SkincareResults #UGC #BloomAndCo", hashtags: ['BeforeAndAfter', 'VitaminC', 'SkincareResults', 'UGC', 'BloomAndCo'], type: 'post' },
    { caption: "Morning ritual > morning routine 🌅\n\nStep 1: Cleanse with our Gentle Foam Wash\nStep 2: Bloom Hydra Toner\nStep 3: SPF Glow Serum\nStep 4: Protect with Sunguard SPF 50+\n\nSave this for your shelf 🛒\n\n#MorningRoutine #SkincareRoutine #SkincareTips #BloomAndCo #GRWM", hashtags: ['MorningRoutine', 'SkincareRoutine', 'SkincareTips', 'BloomAndCo', 'GRWM'], type: 'carousel' },
    { caption: "The Bloom Summer Collection is HERE 🌸🌊\n\nFormulated for heat, humidity & holiday skin. Everything your skin needs from June to September.\n\nAvailable now — link in bio ✨\n\n#SummerCollection #SummerSkincare #BloomAndCo #NewLaunch #SkincareAddict", hashtags: ['SummerCollection', 'SummerSkincare', 'BloomAndCo', 'NewLaunch'], type: 'post' },
    { caption: "We asked. You answered. 👇\n\n'What's the one Bloom product you'd take to a desert island?'\n\nThe winner? The Hydra-Burst Cream — 68% of votes. You really do know what your skin loves 💛\n\n#CommunityPoll #BloomFaves #SkincareCommunity #BloomAndCo", hashtags: ['CommunityPoll', 'BloomFaves', 'SkincareCommunity', 'BloomAndCo'], type: 'post' },
    { caption: "Behind the formula ✨\n\nEver wonder how we create a shade that works on EVERY skin tone?\n\nOur product team went deep on the science of inclusive beauty. This is that story.\n\n#BehindTheScenes #InclusiveBeauty #BloomAndCo #BeautyScience", hashtags: ['BehindTheScenes', 'InclusiveBeauty', 'BloomAndCo', 'BeautyScience'], type: 'post' },
    { caption: "New in: The Bloom Gua Sha + Serum Duo 🪨✨\n\nSculpt. Glow. Repeat.\n\nLimited launch stock — tap to shop before it's gone 🛒\n\n#GuaSha #FaceSculpt #BloomAndCo #SkincareTools #FaceMassage", hashtags: ['GuaSha', 'FaceSculpt', 'BloomAndCo', 'SkincareTools'], type: 'post' },
    { caption: "Summer nights call for a bold lip 🌙💋\n\nOur new Midnight Gloss collection is giving everything we've ever wanted in a gloss — high shine, plumping, non-sticky, 8-hour wear.\n\nComment your fave shade to win a full set 💌\n\n#MidnightGloss #LipGloss #BloomMakeup #SummerMakeup #BloomAndCo", hashtags: ['MidnightGloss', 'LipGloss', 'BloomMakeup', 'SummerMakeup'], type: 'post' },
  ];

  const bloomReels = [
    { caption: "POV: You just discovered the smoothest primer on earth 😮💨\n\n#BloomAndCo #SkincareTok #PrimerHack #GetReadyWithMe #GRWM #MakeupTok #fyp", hashtags: ['BloomAndCo', 'SkincareTok', 'PrimerHack', 'GRWM', 'MakeupTok', 'fyp'] },
    { caption: "Testing the internet's most viral skincare hacks so you don't have to 🧪\n\n(Spoiler: ours actually works)\n\n#SkincareTok #BloomAndCo #ViralSkincare #BeautyHacks #fyp", hashtags: ['SkincareTok', 'BloomAndCo', 'ViralSkincare', 'BeautyHacks', 'fyp'] },
    { caption: "Your morning routine upgrade starts here ☀️ Part 1: The Glow Serum + SPF stack 🔥\n\n#MorningRoutine #GlowUp #BloomAndCo #SkincareRoutine #fyp #SkincareTok", hashtags: ['MorningRoutine', 'GlowUp', 'BloomAndCo', 'SkincareRoutine', 'fyp'] },
    { caption: "We gave 5 girls the same base, different lips. Results? 😍\n\nSwipe to see all 12 shades of the Velvet Lip Tint in action 💄\n\n#LipTint #BloomMakeup #BloomAndCo #MakeupTok #fyp #LipSwatches", hashtags: ['LipTint', 'BloomMakeup', 'BloomAndCo', 'MakeupTok', 'fyp'] },
    { caption: "Day 1 → Day 30 ✨ The glow-up is real 🙌\n\nHydra-Burst Cream 30-day challenge — her skin speaks for itself 💛\n\n#30DayChallenge #SkinTransformation #BloomAndCo #SkincareTok #fyp", hashtags: ['30DayChallenge', 'SkinTransformation', 'BloomAndCo', 'SkincareTok', 'fyp'] },
  ];

  const bloomTikTokPosts = [
    { caption: "Replying to @user7821 — Yes the Glow Serum works on oily skin! Here's how 🔥 #SkincareTok #BloomAndCo #OilySkin #fyp #SkincareHacks", hashtags: ['SkincareTok', 'BloomAndCo', 'OilySkin', 'fyp', 'SkincareHacks'] },
    { caption: "Skin check: 3 months on Bloom products ✨ Full routine in the comments! #BloomAndCo #Skincare #GlowUp #SkincareTok #fyp", hashtags: ['BloomAndCo', 'Skincare', 'GlowUp', 'SkincareTok', 'fyp'] },
    { caption: "this $28 serum is doing $200 serum things 😭💛 #DupeAlert #SkincareTok #BloomAndCo #AffordableSkincare #fyp", hashtags: ['DupeAlert', 'SkincareTok', 'BloomAndCo', 'AffordableSkincare', 'fyp'] },
    { caption: "rating the new Bloom summer collection from 1–10 🌸 (spoiler: it's mostly 10s) #NewRelease #BloomAndCo #SummerSkincare #SkincareTok #fyp", hashtags: ['NewRelease', 'BloomAndCo', 'SummerSkincare', 'SkincareTok', 'fyp'] },
    { caption: "Pack an order with us 📦💌 Behind the scenes at Bloom HQ! #PackageWithMe #BloomAndCo #SmallBusiness #fyp #BeautyTok", hashtags: ['PackageWithMe', 'BloomAndCo', 'SmallBusiness', 'fyp', 'BeautyTok'] },
    { caption: "wait, HOW did they make this formula so lightweight? ✨ #BloomAndCo #SkincareTok #Lightweight #fyp #MoistureBarrier", hashtags: ['BloomAndCo', 'SkincareTok', 'Lightweight', 'fyp', 'MoistureBarrier'] },
    { caption: "the shade range just changed everything 🎨💄 #LipTint #BloomMakeup #MakeupTok #fyp #BloomAndCo", hashtags: ['LipTint', 'BloomMakeup', 'MakeupTok', 'fyp', 'BloomAndCo'] },
    { caption: "how I get my glass skin in 4 steps 🪟✨ @bloomandco routine #GlassSkin #SkincareTok #BloomAndCo #fyp #SkincareRoutine", hashtags: ['GlassSkin', 'SkincareTok', 'BloomAndCo', 'fyp', 'SkincareRoutine'] },
  ];

  // Publish Instagram posts
  for (let i = 0; i < bloomInstagramPosts.length; i++) {
    const daysBack = (i + 1) * 3;
    const publishedAt = daysAgo(daysBack);
    const reach = rand(8000, 55000);
    const likes = rand(400, 4200);
    const comments = rand(30, 380);
    const shares = rand(20, 300);
    const saves = rand(80, 1200);
    await SocialPost.create({
      client: client2._id,
      socialAccount: bl_instagram._id,
      platform: 'instagram',
      contentType: bloomInstagramPosts[i].type,
      caption: bloomInstagramPosts[i].caption,
      hashtags: bloomInstagramPosts[i].hashtags,
      mediaUrls: [pick(PLACEHOLDER_IMAGES.product), pick(PLACEHOLDER_IMAGES.lifestyle)],
      status: 'published',
      publishedAt,
      scheduledAt: new Date(publishedAt.getTime() - 30 * 60 * 1000),
      createdBy: socialUser._id,
      assignedTo: designerUser._id,
      approvedBy: managerUser._id,
      publishedBy: socialUser._id,
      metrics: { likes, comments, shares, saves, views: rand(12000, 80000), reach, impressions: Math.floor(reach * 1.4), clicks: rand(200, 2000), profileVisits: rand(100, 800), engagementRate: parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) },
      isClientVisible: true
    });
  }

  // Publish Reels
  for (let i = 0; i < bloomReels.length; i++) {
    const daysBack = (i + 1) * 4;  // max 20 days back
    const publishedAt = daysAgo(daysBack);
    const reach = rand(20000, 180000);
    const likes = rand(1200, 12000);
    const comments = rand(80, 900);
    const shares = rand(200, 2400);
    const saves = rand(300, 3500);
    await SocialPost.create({
      client: client2._id,
      socialAccount: bl_instagram._id,
      platform: 'instagram',
      contentType: 'reel',
      caption: bloomReels[i].caption,
      hashtags: bloomReels[i].hashtags,
      mediaUrls: [pick(PLACEHOLDER_IMAGES.lifestyle)],
      status: 'published',
      publishedAt,
      scheduledAt: new Date(publishedAt.getTime() - 30 * 60 * 1000),
      createdBy: editorUser._id,
      assignedTo: editorUser._id,
      approvedBy: managerUser._id,
      publishedBy: socialUser._id,
      metrics: { likes, comments, shares, saves, views: rand(40000, 320000), reach, impressions: Math.floor(reach * 1.6), clicks: rand(500, 4000), profileVisits: rand(400, 3000), engagementRate: parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) },
      isClientVisible: true
    });
  }

  // Publish TikTok posts
  for (let i = 0; i < bloomTikTokPosts.length; i++) {
    const daysBack = (i + 1) * 3;  // max 24 days back
    const publishedAt = daysAgo(daysBack);
    const reach = rand(15000, 250000);
    const likes = rand(800, 18000);
    const comments = rand(60, 1200);
    const shares = rand(100, 3000);
    await SocialPost.create({
      client: client2._id,
      socialAccount: bl_tiktok._id,
      platform: 'tiktok',
      contentType: 'video',
      caption: bloomTikTokPosts[i].caption,
      hashtags: bloomTikTokPosts[i].hashtags,
      mediaUrls: [pick(PLACEHOLDER_IMAGES.lifestyle)],
      status: 'published',
      publishedAt,
      scheduledAt: new Date(publishedAt.getTime() - 30 * 60 * 1000),
      createdBy: socialUser._id,
      assignedTo: editorUser._id,
      approvedBy: managerUser._id,
      publishedBy: socialUser._id,
      metrics: { likes, comments, shares, saves: rand(200, 2500), views: rand(30000, 500000), reach, impressions: Math.floor(reach * 1.8), clicks: rand(300, 3000), engagementRate: parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) },
      isClientVisible: true
    });
  }

  // Bloom scheduled + draft posts
  await SocialPost.create({
    client: client2._id, socialAccount: bl_instagram._id, platform: 'instagram',
    contentType: 'carousel',
    caption: "Your complete summer skincare shelf 🌞 All 6 essentials, ranked by our community.\n\nSave this post 💛\n\n#SummerSkincare #BloomAndCo #SkincareEssentials #SkincareTok",
    hashtags: ['SummerSkincare', 'BloomAndCo', 'SkincareEssentials'],
    mediaUrls: PLACEHOLDER_IMAGES.product.slice(0, 4),
    status: 'scheduled',
    scheduledAt: daysFromNow(1),
    createdBy: socialUser._id, assignedTo: designerUser._id, approvedBy: managerUser._id,
    isClientVisible: true
  });
  await SocialPost.create({
    client: client2._id, socialAccount: bl_tiktok._id, platform: 'tiktok',
    contentType: 'video',
    caption: "testing the new Gua Sha duo on camera for the first time 🪨 watch till the end 😮 #BloomAndCo #GuaSha #SkincareTok #fyp",
    hashtags: ['BloomAndCo', 'GuaSha', 'SkincareTok', 'fyp'],
    status: 'scheduled',
    scheduledAt: daysFromNow(3),
    createdBy: editorUser._id, assignedTo: editorUser._id,
    isClientVisible: true,
    notes: 'Trending audio identified: "Golden Hour". Jake to add in edit.'
  });
  await SocialPost.create({
    client: client2._id, socialAccount: bl_instagram._id, platform: 'instagram',
    contentType: 'story',
    caption: "Flash Sale: 30% off all serums — TODAY ONLY ⚡\n\nSwipe up to shop 🛒\n\n#FlashSale #BloomAndCo",
    hashtags: ['FlashSale', 'BloomAndCo'],
    status: 'draft',
    createdBy: copywriterUser._id, assignedTo: designerUser._id,
    isClientVisible: false,
    notes: 'Needs Diana approval before we go live. Confirm sale dates with her.'
  });

  console.log('  ↳ Bloom & Co social posts done');

  // ── Social Posts — Foster Real Estate ──────────────────────────────────────

  const fosterPosts = [
    { caption: "Just listed in Maplewood Heights 🏡\n\n4 bed | 3 bath | 2,400 sqft | $875,000\n\nSpacious family home with updated kitchen, large backyard and top-rated school district. Book a viewing 👇\n\n#JustListed #MaplewoodHeights #FosterRealty #RealEstate #DreamHome", platform: 'instagram', type: 'post' },
    { caption: "What does $500K get you in 2024? 🏘️\n\nWe broke down 5 different neighbourhoods so you can compare. Swipe through 👉\n\n#HomeSearch #RealEstateMarket #FosterRealty #FirstTimeHomeBuyer", platform: 'instagram', type: 'carousel' },
    { caption: "✅ SOLD in 8 days — 14% above asking price!\n\nCongratulations to the Chen family on their new home in Riverside Park 🎉🔑\n\nThinking of selling? Let's talk 📞\n\n#JustSold #FosterRealty #RealEstate #SoldOverAsk", platform: 'facebook', type: 'post' },
    { caption: "Is now a good time to buy? 🤔\n\nOur market report for Q2 is out — and the data is actually more interesting than you'd expect.\n\nFull report linked below 📊\n\n#RealEstateMarket #MarketReport #FosterRealty #Homebuying", platform: 'facebook', type: 'post' },
  ];

  for (let i = 0; i < fosterPosts.length; i++) {
    const daysBack = (i + 1) * 5;
    const publishedAt = daysAgo(daysBack);
    const reach = rand(500, 4200);
    const likes = rand(20, 180);
    const comments = rand(3, 40);
    const shares = rand(5, 60);
    const account = fosterPosts[i].platform === 'instagram' ? fr_instagram._id : fr_facebook._id;
    await SocialPost.create({
      client: client3._id,
      socialAccount: account,
      platform: fosterPosts[i].platform,
      contentType: fosterPosts[i].type,
      caption: fosterPosts[i].caption,
      hashtags: fosterPosts[i].caption.match(/#(\w+)/g)?.map(h => h.slice(1)) || [],
      mediaUrls: [pick(PLACEHOLDER_IMAGES.realestate)],
      status: 'published',
      publishedAt,
      scheduledAt: new Date(publishedAt.getTime() - 30 * 60 * 1000),
      createdBy: socialUser._id,
      assignedTo: designerUser._id,
      approvedBy: adminUser._id,
      publishedBy: socialUser._id,
      metrics: { likes, comments, shares, saves: rand(5, 50), views: rand(800, 8000), reach, impressions: Math.floor(reach * 1.2), clicks: rand(10, 120), engagementRate: parseFloat((((likes + comments + shares) / reach) * 100).toFixed(2)) },
      isClientVisible: true
    });
  }

  // Foster scheduled posts
  await SocialPost.create({
    client: client3._id, socialAccount: fr_instagram._id, platform: 'instagram',
    contentType: 'reel',
    caption: "Toured this stunning property today 🏡✨ Full tour coming to the page soon — would you live here?\n\n#PropertyTour #FosterRealty #RealEstate #HomeTour #fyp",
    hashtags: ['PropertyTour', 'FosterRealty', 'RealEstate', 'HomeTour', 'fyp'],
    status: 'scheduled',
    scheduledAt: daysFromNow(2),
    createdBy: editorUser._id, assignedTo: editorUser._id,
    isClientVisible: true
  });

  console.log('  ↳ Foster Real Estate social posts done');
  console.log('📱 All social posts created');

  // ── Tasks ──────────────────────────────────────────────────────────────────

  await Task.insertMany([
    // TechNova
    { title: 'Q3 Meta Ads Campaign Setup', description: 'Set up and launch Q3 Meta (Facebook + Instagram) campaigns for TechNova targeting enterprise SaaS decision-makers. Full funnel: awareness → retargeting → conversion.', client: client1._id, assignedTo: marketerUser._id, createdBy: managerUser._id, status: 'in_progress', priority: 'high', category: 'paid_ads', deadline: daysFromNow(7), isClientVisible: true, estimatedHours: 12 },
    { title: 'Redesign Ad Creatives — July Pack', description: 'Design 10 new static ad creatives and 3 carousel sets for TechNova Q3 campaigns. Follow brand guidelines v2.', client: client1._id, assignedTo: designerUser._id, createdBy: managerUser._id, status: 'pending', priority: 'high', category: 'graphic_design', deadline: daysFromNow(5), isClientVisible: true, estimatedHours: 10 },
    { title: 'Write Ad Copy — Q3 Campaign', description: 'Write primary, headline, and description copy for all 10 ad variants. 3 tone variations each (formal, conversational, bold).', client: client1._id, assignedTo: copywriterUser._id, createdBy: managerUser._id, status: 'pending', priority: 'medium', category: 'copywriting', deadline: daysFromNow(4), isClientVisible: false, estimatedHours: 6 },
    { title: 'Monthly Performance Report — June', description: 'Compile and publish the June performance report with ROAS, leads, spend breakdowns per channel.', client: client1._id, assignedTo: marketerUser._id, createdBy: managerUser._id, status: 'completed', priority: 'medium', category: 'reporting', isClientVisible: true, completedAt: daysAgo(2), estimatedHours: 4, actualHours: 3.5 },
    { title: 'LinkedIn Content Calendar — July', description: 'Plan and schedule 8 posts for July. Mix: 3 thought leadership, 2 product, 2 hiring, 1 case study.', client: client1._id, assignedTo: copywriterUser._id, createdBy: managerUser._id, status: 'completed', priority: 'medium', category: 'social_media', isClientVisible: true, completedAt: daysAgo(5), estimatedHours: 3, actualHours: 2.5 },
    { title: 'Google Ads Keyword Audit — Q3', description: 'Review and expand keyword list. Remove non-converters. Add BOFU intent terms from search term reports.', client: client1._id, assignedTo: marketerUser._id, createdBy: managerUser._id, status: 'in_progress', priority: 'high', category: 'paid_ads', deadline: daysFromNow(3), isClientVisible: false, estimatedHours: 5 },
    { title: 'SEO Technical Audit — TechNova.com', description: 'Full technical SEO crawl: Core Web Vitals, broken links, structured data, sitemap, robots.txt, page speed.', client: client1._id, assignedTo: marketerUser._id, createdBy: adminUser._id, status: 'pending', priority: 'medium', category: 'strategy', deadline: daysFromNow(10), isClientVisible: true, estimatedHours: 8 },
    { title: 'Can we run LinkedIn Lead Gen Ads?', description: 'We want to test LinkedIn Lead Gen Forms targeting VP-level and C-suite in the US and UK. Budget flexible.', client: client1._id, assignedTo: managerUser._id, createdBy: clientUser1._id, status: 'pending', priority: 'medium', category: 'client_request', isClientVisible: true, isClientRequest: true },
    // Bloom & Co
    { title: 'July Social Media Content Calendar', description: 'Create full-month content calendar for Bloom & Co across Instagram, TikTok, and Facebook. Include Reels concepts, Stories plans, and static post schedule.', client: client2._id, assignedTo: socialUser._id, createdBy: managerUser._id, status: 'in_progress', priority: 'high', category: 'social_media', deadline: daysFromNow(5), isClientVisible: true, estimatedHours: 8 },
    { title: 'Edit 3 Reels — Summer Collection', description: 'Edit the 3 raw video clips Diana sent into polished Reels (15s each). Add trending audio + captions. Export in 9:16 and 1:1.', client: client2._id, assignedTo: editorUser._id, createdBy: managerUser._id, status: 'in_progress', priority: 'urgent', category: 'video_editing', deadline: daysFromNow(2), isClientVisible: true, estimatedHours: 5 },
    { title: 'Design Summer Product Launch Graphics', description: 'Design full graphic suite for summer collection launch: Instagram feed, Stories, TikTok cover, email header, website banner.', client: client2._id, assignedTo: designerUser._id, createdBy: managerUser._id, status: 'completed', priority: 'high', category: 'graphic_design', isClientVisible: true, completedAt: daysAgo(3), estimatedHours: 8, actualHours: 9 },
    { title: 'Influencer Outreach — August Campaign', description: 'Identify and pitch 15 micro-influencers (50K–250K) in the skincare/beauty niche for August UGC campaign.', client: client2._id, assignedTo: socialUser._id, createdBy: managerUser._id, status: 'pending', priority: 'medium', category: 'social_media', deadline: daysFromNow(12), isClientVisible: false, estimatedHours: 6 },
    { title: 'Write Product Descriptions — New SKUs', description: 'Write SEO-optimised product descriptions for 8 new SKUs in the summer collection. Tone: warm, aspirational, benefit-led.', client: client2._id, assignedTo: copywriterUser._id, createdBy: managerUser._id, status: 'pending', priority: 'medium', category: 'copywriting', deadline: daysFromNow(6), isClientVisible: false, estimatedHours: 4 },
    { title: 'Can we add Instagram Stories ads?', description: 'Would like to test Instagram Stories placements for our summer collection. Can we set this up alongside the existing feed campaigns?', client: client2._id, assignedTo: managerUser._id, createdBy: clientUser2._id, status: 'pending', priority: 'medium', category: 'client_request', isClientVisible: true, isClientRequest: true },
    { title: 'June Social Media Monthly Report', description: 'Compile full social performance report for June: reach, engagement, follower growth, top performing posts, recommendations.', client: client2._id, assignedTo: socialUser._id, createdBy: managerUser._id, status: 'completed', priority: 'medium', category: 'reporting', isClientVisible: true, completedAt: daysAgo(7), estimatedHours: 3, actualHours: 2.5 },
    // Foster Real Estate
    { title: 'Launch Google Search Ads — Lead Gen', description: 'Set up Google Search campaigns targeting high-intent real estate keywords in the Greater Metro area. Goal: property valuation + buyer enquiry leads.', client: client3._id, assignedTo: marketerUser._id, createdBy: adminUser._id, status: 'in_progress', priority: 'high', category: 'paid_ads', deadline: daysFromNow(5), isClientVisible: true, estimatedHours: 10 },
    { title: 'Onboarding Call — Strategy Presentation', description: 'Prepare and present 90-day strategy deck for Ryan. Cover: PPC approach, SEO roadmap, content plan, KPIs.', client: client3._id, assignedTo: managerUser._id, createdBy: adminUser._id, status: 'completed', priority: 'high', category: 'reporting', isClientVisible: true, completedAt: daysAgo(4), estimatedHours: 3, actualHours: 2.5 },
    { title: 'Website SEO Baseline Audit', description: 'Run full SEO audit of fosterrealty.com: on-page, off-page, technical. Deliver prioritised action list.', client: client3._id, assignedTo: marketerUser._id, createdBy: adminUser._id, status: 'pending', priority: 'medium', category: 'strategy', deadline: daysFromNow(8), isClientVisible: true, estimatedHours: 6 },
  ]);

  console.log('✅ Tasks created');

  // ── Updates ────────────────────────────────────────────────────────────────

  await Update.insertMany([
    { client: client1._id, author: managerUser._id, title: '🚀 Q3 Campaigns Live!', content: `Great news — your Q3 Meta and Google campaigns are officially live as of Monday!\n\nWe've launched 4 ad sets targeting enterprise buyers across Awareness, Consideration, and Conversion stages. Early signals are strong: CTR is sitting at 4.2%, which is well above the industry benchmark of 2.8%.\n\nWe'll share a full Week 1 report by Friday. Keep an eye on the Reports section.`, type: 'campaign_launch', isPinned: true, tags: ['meta-ads', 'google-ads', 'launch'] },
    { client: client1._id, author: marketerUser._id, title: 'Lead Volume Update — Week 2', content: `Week 2 numbers are looking strong:\n\n• 47 leads generated across all channels\n• Cost per lead: $28.40 (our target was $35 — we beat it!)\n• Top performing ad: "Free Trial" carousel variant B\n• Worst performer paused: "Features" static banner\n\nWe've reallocated the paused budget to the top 2 performers. Expect volume to increase heading into week 3.`, type: 'optimization', tags: ['leads', 'meta-ads', 'optimization'] },
    { client: client1._id, author: marketerUser._id, title: 'Google Ads: Quality Score Improvements', content: `Following last week's landing page optimisation, we've seen significant Quality Score improvements across the main keyword groups:\n\n• "SaaS CRM software": 6 → 9\n• "business automation tool": 5 → 8\n• "team productivity software": 7 → 9\n\nHigher Quality Scores = lower CPCs. We're now paying 22% less per click on average. This compounds over time — great news for monthly ROI.`, type: 'optimization', tags: ['google-ads', 'seo', 'quality-score'] },
    { client: client1._id, author: adminUser._id, title: 'Monthly Strategy Review — Notes & Decisions', content: `Following our monthly call on Thursday, here are the key decisions made:\n\n✅ Approved: Increase Meta budget by $2,000/month for Q3\n✅ Approved: LinkedIn Lead Gen Ads test — starting August 1st\n✅ Decision: Pause LinkedIn Company page posts for 2 weeks to refresh strategy\n⏳ Pending: Marcus to confirm webinar date for retargeting campaign\n\nNext call: August 8th, 10am EST.`, type: 'general', isPinned: false, tags: ['strategy', 'meeting-notes'] },
    { client: client2._id, author: socialUser._id, title: 'July Content Calendar Ready for Review', content: `Hi Diana! Your July content calendar is ready and uploaded to your Files section 📁\n\nHere's what's included:\n• 20 feed posts (product, UGC-style & lifestyle)\n• 30 Stories frames (templates + swipe-up links)\n• 4 Reels concepts with hooks, scripts & trending audio suggestions\n• Updated hashtag strategy (removed stale tags, added 12 high-performing new ones)\n\nPlease review and let us know if you'd like any changes before we start scheduling!`, type: 'general', isPinned: true, tags: ['social-media', 'content', 'review'] },
    { client: client2._id, author: editorUser._id, title: '🎬 Summer Reels — Edits Complete', content: `All 3 summer collection Reels are done and uploaded to your Files section!\n\n• Reel 1: Product reveal — Glow Serum spotlight (trending audio: Golden Hour ✅)\n• Reel 2: Behind the scenes / lifestyle feel — morning routine format\n• Reel 3: Before & after — customer testimonial mashup\n\nAll exported in 9:16 (Reels) and 1:1 (feed). Once you approve, we'll schedule them during the top engagement windows (Tue/Thu 7–9pm).`, type: 'general', tags: ['video', 'reels', 'creative'] },
    { client: client2._id, author: socialUser._id, title: '📈 June Social Highlights', content: `June was a strong month across all platforms! Here are the highlights:\n\n📱 Instagram:\n• Reach: 445,000 (+18% MoM)\n• Top Reel: 312K views, 8.4% engagement rate\n• Follower growth: +1,840\n\n🎵 TikTok:\n• 3 videos crossed 100K views\n• New followers: +4,200 (best month to date!)\n• Top video: 287K views on the "budget dupe" format\n\nFull breakdown is in your June Report. Huge month!`, type: 'general', isPinned: false, tags: ['social-media', 'monthly-results', 'june'] },
    { client: client2._id, author: managerUser._id, title: 'Influencer Collaboration Update', content: `Quick update on the August influencer campaign:\n\nWe've shortlisted 8 micro-influencers in the skincare/beauty space (50K–200K followers). All have above-average engagement rates (4–8%) and strong female 18–34 audience overlap.\n\nNext steps:\n1. Dani to send outreach DMs this week\n2. We'll negotiate usage rights for repurposing as ads\n3. Brief delivery: July 22nd\n\nWe'll keep you updated as confirmations come in!`, type: 'general', tags: ['influencers', 'ugc', 'august'] },
    { client: client3._id, author: adminUser._id, title: '👋 Welcome to the Portal, Ryan!', content: `Hi Ryan! Welcome to the ToFly Media client portal.\n\nThis is your central hub for everything related to your campaigns:\n\n📊 Reports — Monthly performance breakdowns\n📁 Files — Creative assets, contracts, strategy docs\n💬 Messages — Direct line to your team\n🎯 Tasks — Track what we're working on\n\nWe've kicked off your Google Ads setup and SEO audit. Expect your first update within 48 hours.\n\nDon't hesitate to reach out if you need anything!`, type: 'general', isPinned: true, tags: ['welcome', 'onboarding'] },
    { client: client3._id, author: managerUser._id, title: '90-Day Strategy Plan — Delivered', content: `Your strategy presentation from Tuesday's onboarding call has been uploaded to the Files section.\n\nSummary of what we covered:\n\n📍 Month 1: Google Ads launch + technical SEO foundation\n📍 Month 2: SEO content blitz (8 blog posts + local landing pages) + Google Ads optimisation\n📍 Month 3: Scale winners, A/B test ad creative, launch retargeting\n\nTarget by Month 3: 80+ qualified leads/month at <$65 CPL.\n\nLet us know if you have any questions after reviewing!`, type: 'general', tags: ['strategy', 'onboarding', 'roadmap'] },
  ]);

  console.log('📋 Updates created');

  // ── Reports ────────────────────────────────────────────────────────────────

  await Report.insertMany([
    // TechNova — 3 months of reports
    { client: client1._id, createdBy: managerUser._id, title: 'April 2024 Performance Report', period: 'monthly', startDate: new Date('2024-04-01'), endDate: new Date('2024-04-30'), metrics: { adSpend: 11200, revenue: 52640, roas: 4.7, leads: 218, conversions: 34, impressions: 380000, clicks: 15400, ctr: 4.05, cpc: 0.73, cpl: 51.38 }, channels: [{ name: 'Meta Ads', spend: 4500, revenue: 21150, conversions: 14, leads: 88 }, { name: 'Google Search', spend: 4700, revenue: 24650, conversions: 16, leads: 108 }, { name: 'LinkedIn Ads', spend: 2000, revenue: 6840, conversions: 4, leads: 22 }], highlights: ['ROAS improved from 4.1x to 4.7x', 'LinkedIn launched — solid early CPL of $90', 'Meta creative refresh drove 28% CTR improvement'], recommendations: ['Test video ads on Meta', 'Expand LinkedIn to APAC geo', 'Increase retargeting budget'], isPublished: true },
    { client: client1._id, createdBy: managerUser._id, title: 'May 2024 Performance Report', period: 'monthly', startDate: new Date('2024-05-01'), endDate: new Date('2024-05-31'), metrics: { adSpend: 11800, revenue: 60180, roas: 5.1, leads: 254, conversions: 41, impressions: 405000, clicks: 16900, ctr: 4.17, cpc: 0.70, cpl: 46.46 }, channels: [{ name: 'Meta Ads', spend: 4800, revenue: 25440, conversions: 16, leads: 102 }, { name: 'Google Search', spend: 4800, revenue: 28320, conversions: 19, leads: 118 }, { name: 'LinkedIn Ads', spend: 2200, revenue: 6420, conversions: 6, leads: 34 }], highlights: ['ROAS hit 5.1x — new record at the time', 'Video ads on Meta outperformed static by 41%', 'LinkedIn CPL dropped from $90 to $64'], recommendations: ['Scale Meta video budget', 'Launch LinkedIn Lead Gen Forms', 'Test Google Display retargeting'], isPublished: true },
    { client: client1._id, createdBy: managerUser._id, title: 'June 2024 Performance Report', period: 'monthly', startDate: new Date('2024-06-01'), endDate: new Date('2024-06-30'), metrics: { adSpend: 12500, revenue: 68750, roas: 5.5, leads: 284, conversions: 47, impressions: 425000, clicks: 18200, ctr: 4.28, cpc: 0.69, cpl: 44.01 }, channels: [{ name: 'Meta Ads', spend: 5000, revenue: 27500, conversions: 18, leads: 112 }, { name: 'Google Search', spend: 5000, revenue: 31250, conversions: 22, leads: 134 }, { name: 'LinkedIn Ads', spend: 2500, revenue: 10000, conversions: 7, leads: 38 }], highlights: ['Best ROAS month to date: 5.5x', 'Meta CPL dropped 31% after creative refresh', 'LinkedIn expanding into APAC showing early promise'], recommendations: ['Increase Meta budget by 20%', 'Test video ads on LinkedIn', 'Launch retargeting for webinar registrants'], isPublished: true },
    // Bloom & Co — 3 months of reports
    { client: client2._id, createdBy: marketerUser._id, title: 'April 2024 Social & Ads Report', period: 'monthly', startDate: new Date('2024-04-01'), endDate: new Date('2024-04-30'), metrics: { adSpend: 5800, revenue: 20300, roas: 3.5, leads: 0, conversions: 248, impressions: 720000, clicks: 19800, ctr: 2.75, engagements: 48200, reach: 360000 }, channels: [{ name: 'Instagram', spend: 3600, revenue: 13320, conversions: 178 }, { name: 'TikTok', spend: 1200, revenue: 4200, conversions: 52 }, { name: 'Facebook', spend: 1000, revenue: 2780, conversions: 18 }], highlights: ['ROAS 3.5x — meeting target', 'TikTok showing strong organic growth', 'First Reel crossed 50K views'], recommendations: ['Increase TikTok budget', 'Test Collab posts with micro-influencers', 'A/B test Reels hooks'], isPublished: true },
    { client: client2._id, createdBy: marketerUser._id, title: 'May 2024 Social & Ads Report', period: 'monthly', startDate: new Date('2024-05-01'), endDate: new Date('2024-05-31'), metrics: { adSpend: 6200, revenue: 24180, roas: 3.9, leads: 0, conversions: 282, impressions: 810000, clicks: 22100, ctr: 2.73, engagements: 55400, reach: 405000 }, channels: [{ name: 'Instagram', spend: 3800, revenue: 15960, conversions: 192 }, { name: 'TikTok', spend: 1400, revenue: 4900, conversions: 64 }, { name: 'Facebook', spend: 1000, revenue: 3320, conversions: 26 }], highlights: ['ROAS improved to 3.9x', 'TikTok: 3 viral videos, +18K followers', 'Instagram Reels averaging 42K views'], recommendations: ['Repurpose top TikToks as Instagram Reels', 'Launch Summer Collection campaign early', 'Influencer campaign brief to go out June 1st'], isPublished: true },
    { client: client2._id, createdBy: marketerUser._id, title: 'June 2024 Social & Ads Report', period: 'monthly', startDate: new Date('2024-06-01'), endDate: new Date('2024-06-30'), metrics: { adSpend: 6500, revenue: 26650, roas: 4.1, leads: 0, conversions: 312, impressions: 890000, clicks: 24500, ctr: 2.75, engagements: 61300, reach: 445000 }, channels: [{ name: 'Instagram', spend: 4000, revenue: 18400, conversions: 210 }, { name: 'TikTok', spend: 1500, revenue: 5250, conversions: 72 }, { name: 'Facebook', spend: 1000, revenue: 3000, conversions: 30 }], highlights: ['ROAS 4.1x exceeds 3.5x target', 'Reels driving 3x engagement vs static posts', 'TikTok best month: 18K new followers'], isPublished: true },
  ]);

  console.log('📊 Reports created');

  // ── Files ──────────────────────────────────────────────────────────────────

  await File.insertMany([
    // TechNova files
    { client: client1._id, uploadedBy: managerUser._id, name: 'June 2024 Performance Report', originalName: 'TechNova_June2024_Report.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 2480000, category: 'report', description: 'Full performance report for June — Meta, Google, LinkedIn breakdown with ROAS analysis.', tags: ['report', 'june', 'monthly'], isPublic: true },
    { client: client1._id, uploadedBy: designerUser._id, name: 'Q3 Ad Creatives Pack v1', originalName: 'TechNova_Q3_Creatives_v1.zip', url: 'https://res.cloudinary.com/demo/image/upload/sample.zip', mimeType: 'application/zip', size: 48200000, category: 'creative', description: '10 static ad creatives + 3 carousel sets. All sizes: 1:1, 4:5, 9:16, 1.91:1', tags: ['creatives', 'q3', 'ads', 'meta'], isPublic: true },
    { client: client1._id, uploadedBy: managerUser._id, name: 'Brand Guidelines v2.0', originalName: 'TechNova_BrandGuidelines_v2.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 8900000, category: 'other', description: 'Updated brand guidelines — typography, colour palette, logo usage, tone of voice.', tags: ['brand', 'guidelines', 'design'], isPublic: true },
    { client: client1._id, uploadedBy: adminUser._id, name: 'Service Agreement — Jan 2024', originalName: 'TechNova_ServiceAgreement_2024.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 1200000, category: 'contract', description: 'Signed service agreement for enterprise retainer — January 2024.', tags: ['contract', 'legal'], isPublic: false },
    { client: client1._id, uploadedBy: managerUser._id, name: 'Q3 Strategy Deck', originalName: 'TechNova_Q3_StrategyDeck.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 5600000, category: 'presentation', description: '90-day Q3 plan: paid media roadmap, content strategy, LinkedIn expansion plan.', tags: ['strategy', 'q3', 'presentation'], isPublic: true },
    // Bloom & Co files
    { client: client2._id, uploadedBy: socialUser._id, name: 'July Content Calendar', originalName: 'BloomCo_JulyCalendar_2024.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 3100000, category: 'presentation', description: 'Full content plan for July across Instagram, TikTok, and Facebook.', tags: ['content', 'calendar', 'july', 'social'], isPublic: true },
    { client: client2._id, uploadedBy: editorUser._id, name: 'Summer Reels — Final Edits', originalName: 'BloomCo_SummerReels_Final.zip', url: 'https://res.cloudinary.com/demo/image/upload/sample.zip', mimeType: 'application/zip', size: 320000000, category: 'media', description: '3 edited Reels in 9:16 and 1:1. Ready to publish pending client approval.', tags: ['reels', 'video', 'summer', 'instagram'], isPublic: true },
    { client: client2._id, uploadedBy: designerUser._id, name: 'Summer Collection — Graphic Pack', originalName: 'BloomCo_SummerGraphics_v2.zip', url: 'https://res.cloudinary.com/demo/image/upload/sample.zip', mimeType: 'application/zip', size: 98000000, category: 'creative', description: 'All graphics for summer launch: Instagram posts, Stories, TikTok covers, email header.', tags: ['graphics', 'summer', 'design', 'social'], isPublic: true },
    { client: client2._id, uploadedBy: marketerUser._id, name: 'June 2024 Social Report', originalName: 'BloomCo_June2024_SocialReport.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 1900000, category: 'report', description: 'Monthly social media performance: reach, engagement, followers, top posts, TikTok breakdown.', tags: ['report', 'june', 'social', 'monthly'], isPublic: true },
    { client: client2._id, uploadedBy: adminUser._id, name: 'Service Agreement — March 2024', originalName: 'BloomCo_ServiceAgreement_2024.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 1100000, category: 'contract', description: 'Signed service agreement for growth retainer — March 2024.', tags: ['contract', 'legal'], isPublic: false },
    // Foster files
    { client: client3._id, uploadedBy: managerUser._id, name: '90-Day Strategy Presentation', originalName: 'Foster_90DayStrategy.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 4200000, category: 'presentation', description: 'Onboarding strategy deck: PPC plan, SEO roadmap, KPIs, milestones.', tags: ['strategy', 'onboarding', 'presentation'], isPublic: true },
    { client: client3._id, uploadedBy: adminUser._id, name: 'Service Agreement — June 2024', originalName: 'Foster_ServiceAgreement_2024.pdf', url: 'https://res.cloudinary.com/demo/image/upload/sample.pdf', mimeType: 'application/pdf', size: 980000, category: 'contract', description: 'Signed service agreement — professional plan, June 2024.', tags: ['contract', 'legal'], isPublic: false },
  ]);

  console.log('📁 Files created');

  // ── Leads ──────────────────────────────────────────────────────────────────

  const batch1 = uuidv4();
  const batch2 = uuidv4();
  const batch3 = uuidv4();
  const batch4 = uuidv4();

  const leadsData = [
    // TechNova — Meta Lead Gen Batch
    { name: "James O'Brien", email: 'james.obrien@acmecorp.com', phone: '+1 555-0100', company: 'Acme Corp', jobTitle: 'CTO', location: 'New York, USA', source: 'Meta Ads', campaign: 'Q2 Lead Gen — CTO Targeting', status: 'contacted', quality: 'hot', notes: 'Booked demo for July 15th. Very interested in API integrations.', batchId: batch1, batchLabel: 'Meta Leads — June W3', client: client1._id },
    { name: 'Sunita Rao', email: 'sunita@growthtech.io', phone: '+1 555-0101', company: 'GrowthTech', jobTitle: 'VP Operations', location: 'Austin, USA', source: 'Meta Ads', campaign: 'Q2 Lead Gen — CTO Targeting', status: 'qualified', quality: 'hot', notes: 'Attended webinar. Ready for proposal stage. Budget confirmed: $2K/mo.', batchId: batch1, batchLabel: 'Meta Leads — June W3', client: client1._id },
    { name: 'Marcus Li', email: 'marcus.li@startupx.com', phone: '+44 7700 900001', company: 'StartupX', jobTitle: 'Co-founder', location: 'London, UK', source: 'Meta Ads', campaign: 'Q2 Lead Gen — CTO Targeting', status: 'new', quality: 'warm', batchId: batch1, batchLabel: 'Meta Leads — June W3', client: client1._id },
    { name: 'Fatima Al-Hassan', email: 'fatima@nexuscloud.ae', phone: '+971 50 123 4567', company: 'NexusCloud', jobTitle: 'IT Director', location: 'Dubai, UAE', source: 'Google Ads', campaign: 'Q2 Lead Gen — CTO Targeting', status: 'new', quality: 'warm', batchId: batch1, batchLabel: 'Meta Leads — June W3', client: client1._id },
    { name: 'David Park', email: 'd.park@techwave.co', phone: '+1 555-0102', company: 'TechWave', jobTitle: 'CEO', location: 'San Francisco, USA', source: 'Google Ads', campaign: 'Q2 Lead Gen — CTO Targeting', status: 'converted', quality: 'hot', notes: 'Signed 6-month contract. $3.5K/mo. Upsell opportunity in Q4.', batchId: batch1, batchLabel: 'Meta Leads — June W3', client: client1._id },
    { name: 'Anika Patel', email: 'anika@cloudcraft.io', phone: '+1 555-0108', company: 'CloudCraft', jobTitle: 'Head of Product', location: 'Seattle, USA', source: 'LinkedIn', campaign: 'Q3 LinkedIn Lead Gen', status: 'qualified', quality: 'hot', notes: 'Completed product demo. Very positive. Proposal sent.', batchId: batch3, batchLabel: 'LinkedIn Leads — July W1', client: client1._id },
    { name: 'Tom Erikson', email: 'tom.e@nordic-saas.com', phone: '+46 70 123 4567', company: 'Nordic SaaS', jobTitle: 'CTO', location: 'Stockholm, Sweden', source: 'LinkedIn', campaign: 'Q3 LinkedIn Lead Gen', status: 'contacted', quality: 'warm', batchId: batch3, batchLabel: 'LinkedIn Leads — July W1', client: client1._id },
    { name: 'Yuki Tanaka', email: 'yuki@tanakacorp.jp', phone: '+81 90 1234 5678', company: 'Tanaka Corp', jobTitle: 'Digital Director', location: 'Tokyo, Japan', source: 'LinkedIn', campaign: 'Q3 LinkedIn Lead Gen', status: 'new', quality: 'cold', batchId: batch3, batchLabel: 'LinkedIn Leads — July W1', client: client1._id },
    { name: 'Rachel Green', email: 'r.green@horizontech.com', phone: '+1 555-0112', company: 'Horizon Tech', jobTitle: 'VP Engineering', location: 'Austin, USA', source: 'Google Ads', campaign: 'Q3 Brand Search', status: 'new', quality: 'warm', batchId: batch3, batchLabel: 'LinkedIn Leads — July W1', client: client1._id },
    { name: 'Carlos Mendes', email: 'c.mendes@innova.co', phone: '+55 11 99999 1234', company: 'Innova Solutions', jobTitle: 'CEO', location: 'São Paulo, Brazil', source: 'Meta Ads', campaign: 'Q3 LATAM Expansion', status: 'lost', quality: 'warm', notes: 'Went with competitor. Budget constraints — revisit in Q1.', batchId: batch3, batchLabel: 'LinkedIn Leads — July W1', client: client1._id },
    // Bloom & Co — Instagram + TikTok leads
    { name: 'Sophie Blanc', email: 'sophie.b@gmail.com', phone: '+33 6 12 34 56 78', location: 'Paris, France', source: 'Instagram', campaign: 'Summer Collection — Awareness', status: 'new', quality: 'warm', batchId: batch2, batchLabel: 'IG Leads — Summer Collection', client: client2._id },
    { name: 'Aaliya Khan', email: 'aaliya.khan@outlook.com', phone: '+44 7700 900002', location: 'Manchester, UK', source: 'Instagram', campaign: 'Summer Collection — Awareness', status: 'contacted', quality: 'warm', notes: 'DM-ed about the Glow Serum. Sent discount code.', batchId: batch2, batchLabel: 'IG Leads — Summer Collection', client: client2._id },
    { name: 'Chloe Rodriguez', email: 'chloe.r@yahoo.com', phone: '+1 555-0103', location: 'Miami, USA', source: 'TikTok', campaign: 'Summer Collection — Awareness', status: 'new', quality: 'cold', batchId: batch2, batchLabel: 'IG Leads — Summer Collection', client: client2._id },
    { name: 'Mei Lin', email: 'mei.lin88@gmail.com', phone: '+65 9123 4567', location: 'Singapore', source: 'Instagram', campaign: 'Summer Collection — Awareness', status: 'qualified', quality: 'hot', notes: 'Placed 3 orders already. Potential brand ambassador. DM open.', batchId: batch2, batchLabel: 'IG Leads — Summer Collection', client: client2._id },
    { name: 'Isabela Costa', email: 'isabela.costa@hotmail.com', phone: '+55 11 91234 5678', location: 'Rio de Janeiro, Brazil', source: 'TikTok', campaign: 'TikTok Viral — Dupe Alert', status: 'new', quality: 'warm', batchId: batch2, batchLabel: 'IG Leads — Summer Collection', client: client2._id },
    { name: 'Priya Nair', email: 'priya.nair@gmail.com', phone: '+91 98765 43210', location: 'Mumbai, India', source: 'Instagram', campaign: 'Summer Collection — Awareness', status: 'contacted', quality: 'warm', batchId: batch2, batchLabel: 'IG Leads — Summer Collection', client: client2._id },
    { name: 'Emma Johansson', email: 'emma.j@live.se', phone: '+46 73 123 4567', location: 'Gothenburg, Sweden', source: 'TikTok', campaign: 'TikTok Viral — Dupe Alert', status: 'new', quality: 'cold', batchId: batch2, batchLabel: 'IG Leads — Summer Collection', client: client2._id },
    // Foster Real Estate leads
    { name: 'Greg Sullivan', email: 'greg.s@gmail.com', phone: '+1 555-0201', location: 'Chicago Metro, USA', source: 'Google Ads', campaign: 'Property Valuation — Search', status: 'contacted', quality: 'hot', notes: 'Looking to sell 4-bed family home. Valuation booked for July 20th.', batchId: batch4, batchLabel: 'Google Leads — July', client: client3._id },
    { name: 'Angela Brooks', email: 'angela.b@outlook.com', phone: '+1 555-0202', location: 'Naperville, USA', source: 'Google Ads', campaign: 'First Time Buyer — Search', status: 'new', quality: 'warm', batchId: batch4, batchLabel: 'Google Leads — July', client: client3._id },
    { name: 'Derek Owens', email: 'd.owens@yahoo.com', phone: '+1 555-0203', location: 'Oak Park, USA', source: 'Facebook', campaign: 'Local Area — Awareness', status: 'new', quality: 'cold', batchId: batch4, batchLabel: 'Google Leads — July', client: client3._id },
    { name: 'Tina Vasquez', email: 'tina.v@gmail.com', phone: '+1 555-0204', location: 'Evanston, USA', source: 'Google Ads', campaign: 'Property Valuation — Search', status: 'qualified', quality: 'hot', notes: 'Motivated seller. Price agreed. Moving to listing phase.', batchId: batch4, batchLabel: 'Google Leads — July', client: client3._id },
  ];

  for (const lead of leadsData) {
    await Lead.create({ ...lead, uploadedBy: managerUser._id, leadDate: new Date(Date.now() - Math.random() * 21 * 24 * 60 * 60 * 1000) });
  }

  console.log('🎯 Leads created');

  // ── Conversations & Messages ───────────────────────────────────────────────

  // TechNova conversation
  const conv1 = await Conversation.create({
    client: client1._id,
    participants: [clientUser1._id, managerUser._id, marketerUser._id],
    lastMessageAt: new Date()
  });
  const msgs1 = await Message.insertMany([
    { conversation: conv1._id, sender: managerUser._id, content: 'Hi Marcus! The June report is live on your dashboard. ROAS hit 5.5x this month 🎉 Best month yet!', readBy: [{ user: managerUser._id }, { user: clientUser1._id }] },
    { conversation: conv1._id, sender: clientUser1._id, content: "Amazing results! Really happy with the direction everything is going. What's next for Q3?", readBy: [{ user: clientUser1._id }, { user: managerUser._id }] },
    { conversation: conv1._id, sender: marketerUser._id, content: 'Q3 campaigns are already live as of Monday! Early CTR is sitting at 4.2% which is well above benchmark. Check the Updates section for the full launch summary.', readBy: [{ user: marketerUser._id }, { user: clientUser1._id }] },
    { conversation: conv1._id, sender: clientUser1._id, content: "Great! Also I submitted a request for LinkedIn Lead Gen Ads — can we discuss on the next call?", readBy: [{ user: clientUser1._id }] },
    { conversation: conv1._id, sender: managerUser._id, content: "Absolutely — I've already flagged it to Priya. We'll have a proposal ready before Thursday's call. Stay tuned 👍", readBy: [{ user: managerUser._id }] },
  ]);
  await Conversation.findByIdAndUpdate(conv1._id, { lastMessage: msgs1[msgs1.length - 1]._id });

  // Bloom & Co conversation
  const conv2 = await Conversation.create({
    client: client2._id,
    participants: [clientUser2._id, managerUser._id, socialUser._id, editorUser._id],
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  });
  const msgs2 = await Message.insertMany([
    { conversation: conv2._id, sender: socialUser._id, content: "Hi Diana! July content calendar is ready for review — all files are in your portal 📁 Let us know what you think!", readBy: [{ user: socialUser._id }] },
    { conversation: conv2._id, sender: clientUser2._id, content: "Love the summer vibes overall! Can we add a few more lifestyle shots? The product-only ones historically don't perform as well for us.", readBy: [{ user: clientUser2._id }, { user: socialUser._id }] },
    { conversation: conv2._id, sender: socialUser._id, content: "100%! I'll swap out 4 of the product-focused posts for lifestyle/UGC format. I'll update the calendar and re-upload by tomorrow 🙌", readBy: [{ user: socialUser._id }, { user: clientUser2._id }] },
    { conversation: conv2._id, sender: editorUser._id, content: "The 3 Reels are done too Diana! Check the Files section — they're ready to post once you give the thumbs up ✅ Trending audio on all 3!", readBy: [{ user: editorUser._id }] },
    { conversation: conv2._id, sender: clientUser2._id, content: "Jake these look incredible!! The before & after Reel is going to do so well 😍 Approving all 3!", readBy: [{ user: clientUser2._id }, { user: editorUser._id }] },
  ]);
  await Conversation.findByIdAndUpdate(conv2._id, { lastMessage: msgs2[msgs2.length - 1]._id });

  // Foster conversation
  const conv3 = await Conversation.create({
    client: client3._id,
    participants: [clientUser3._id, adminUser._id, managerUser._id, marketerUser._id],
    lastMessageAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
  });
  const msgs3 = await Message.insertMany([
    { conversation: conv3._id, sender: adminUser._id, content: "Welcome to the portal Ryan! Really excited to kick things off with the Foster team. The strategy deck from Tuesday's call has been uploaded — let us know if you have any questions.", readBy: [{ user: adminUser._id }] },
    { conversation: conv3._id, sender: clientUser3._id, content: "Thanks Alex! Went through the deck — the 90-day roadmap looks solid. One question: for the Google Ads, are we targeting the whole metro or specific suburbs?", readBy: [{ user: clientUser3._id }, { user: adminUser._id }] },
    { conversation: conv3._id, sender: marketerUser._id, content: "Great question Ryan! We're starting with a 15-mile radius around your office targeting high-intent keywords. Once we have 2 weeks of data, we'll narrow to the top-performing suburbs and scale budget there.", readBy: [{ user: marketerUser._id }, { user: clientUser3._id }] },
    { conversation: conv3._id, sender: clientUser3._id, content: "Perfect, that makes a lot of sense. I'll make sure the team knows to track where enquiries are coming from on our end too.", readBy: [{ user: clientUser3._id }] },
  ]);
  await Conversation.findByIdAndUpdate(conv3._id, { lastMessage: msgs3[msgs3.length - 1]._id });

  console.log('💬 Conversations created');

  // ── Done ───────────────────────────────────────────────────────────────────

  console.log('\n✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 DEMO CREDENTIALS — To Fly Media');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 Admin (CEO):              admin@toflymedia.com        / Admin123!');
  console.log('🗂️  Project Manager:          manager@toflymedia.com      / Manager123!');
  console.log('📊 Performance Marketer:     marketer@toflymedia.com     / Marketer123!');
  console.log('📱 Social Media Manager:     social@toflymedia.com       / Social123!');
  console.log('🎬 Video Editor:             editor@toflymedia.com       / Editor123!');
  console.log('🎨 Graphic Designer:         designer@toflymedia.com     / Designer123!');
  console.log('✍️  Copywriter:               copy@toflymedia.com         / Copy123!');
  console.log('🏢 Client (TechNova):        client@toflymedia.com       / Client123!');
  console.log('🏢 Client (Bloom & Co):      diana.client@toflymedia.com / Client123!');
  console.log('🏢 Client (Foster Realty):   ryan.client@toflymedia.com  / Client123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 DATA SUMMARY:');
  console.log('  • 3 clients (TechNova, Bloom & Co, Foster Realty)');
  console.log('  • 8 social accounts across LinkedIn, Twitter, Instagram, TikTok, Facebook');
  console.log('  • 40+ social posts (published, scheduled & draft)');
  console.log('  • 17 tasks across all clients');
  console.log('  • 10 client updates / announcements');
  console.log('  • 6 monthly performance reports (3 months × 2 clients)');
  console.log('  • 12 files (reports, creatives, contracts, decks)');
  console.log('  • 21 leads across 4 batches');
  console.log('  • 3 conversations with realistic message threads');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
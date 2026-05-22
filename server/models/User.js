const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    // To Fly Media roles:
    // admin            — full access, manages team & agency settings
    // manager          — project manager, assigns tasks, manages clients
    // performance_marketer — runs paid ad campaigns (Meta, Google, TikTok)
    // social_media_manager — manages social content & scheduling
    // video_editor     — edits video content (Reels, TikTok, YT ads)
    // graphic_designer — designs creatives, branding, templates
    // copywriter       — ad copy, captions, email & landing page copy
    // client           — client portal access only
    enum: ['admin', 'manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter', 'client'],
    default: 'copywriter'
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    trim: true
  },
  alternativePhone: {
    type: String,
    trim: true
  },
  documents: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['aadhaar', 'pan', 'passport', 'driving_license', 'other'],
      default: 'other'
    },
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String   // cloudinary public_id for deletion
    },
    fileType: {
      type: String   // 'pdf', 'image', 'docx', etc.
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  jobTitle: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  // For client role: linked client record
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now }
  }],
  notifications: [{
    type: {
      type: String,
      enum: ['message', 'update', 'task', 'file', 'lead', 'general']
    },
    title: String,
    body: String,
    read: { type: Boolean, default: false },
    link: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Helper: is this user a team member (non-client, non-admin)
userSchema.virtual('isTeamMember').get(function () {
  return !['admin', 'manager', 'client'].includes(this.role);
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  return obj;
};

// Map role to display label
userSchema.statics.roleLabel = function (role) {
  const labels = {
    admin: 'Admin',
    manager: 'Project Manager',
    performance_marketer: 'Performance Marketer',
    social_media_manager: 'Social Media Manager',
    video_editor: 'Video Editor',
    graphic_designer: 'Graphic Designer',
    copywriter: 'Copywriter',
    client: 'Client',
  };
  return labels[role] || role;
};

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
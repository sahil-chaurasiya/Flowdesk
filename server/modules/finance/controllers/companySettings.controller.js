const CompanySettings = require('../models/CompanySettings');

// Always returns the single settings doc (creates with defaults if missing)
exports.get = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) settings = await CompanySettings.create({});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create(req.body);
    } else {
      const allowed = [
        'companyName','address','tagline','phone1','phone2',
        'accountHolder','accountType','accountNumber','ifsc','branch','upi'
      ];
      allowed.forEach(k => { if (req.body[k] !== undefined) settings[k] = req.body[k]; });
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
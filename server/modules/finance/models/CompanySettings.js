const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

const companySettingsSchema = new mongoose.Schema({
  // Company Info
  companyName: { type: String, default: 'To Fly Media' },
  address: { type: String, default: 'MANYA ARCADE, ISBT, Narmadapuram Rd, behind Nexa Showroom, Habib Ganj, Bhopal, Madhya Pradesh 462024' },
  tagline: { type: String, default: "We've got a PERFECT match for your needs #360marketingsolution" },
  phone1: { type: String, default: '6260154125' },
  phone2: { type: String, default: '9752523894' },
  // Bank / Payment Details
  accountHolder: { type: String, default: 'Aman Bhardwaj' },
  accountType: { type: String, default: 'Current Account' },
  accountNumber: { type: String, default: '50200077089748' },
  ifsc: { type: String, default: 'HDFC0003662' },
  branch: { type: String, default: 'GULMOHOR, BHOPAL' },
  upi: { type: String, default: '9752523894' },
}, { timestamps: true });

module.exports = bindModel('finance', 'CompanySettings', companySettingsSchema);
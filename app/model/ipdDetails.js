const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    medicineName: { type: String, required: true },
    timing: [{ type: String, enum: ['morning', 'afternoon', 'evening', 'night'], required: true }],
    mealInstruction: { type: String, enum: ['before', 'after'], required: true }
}, { _id: false });

const ipdDetailsSchema = new mongoose.Schema({
    ipdId: { type: mongoose.Schema.Types.ObjectId, ref: 'ipds', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'doctors', required: true },
    instructionDate: { type: Date, default: Date.now },
    
    // Prescription Fields
    complaints: { type: String, default: '' },
    prescriptions: [medicineSchema],
    labInvestigations: { type: String, default: '' },
    labReportFile: { type: String, default: '' }, // Store file path
    advice: { type: String, default: '' },
    remarks: { type: String, default: '' },
    totalDays: { type: Number, default: 15 },
    
    // System Fields
    create: { type: Date, default: Date.now },
    update: { type: Date, default: Date.now },
    delete: { type: Boolean, default: false },
});

const IpdDetail = mongoose.model('ipdDetails', ipdDetailsSchema);

module.exports = IpdDetail;

const { successResponse, errorResponse } = require('../../helper/index');
const Appointment = require('../../model/appointment');
const AppointmentDetail = require('../../model/appointmentdetail');
const IPD = require('../../model/ipd');
const IpdDetail = require('../../model/ipdDetails');
const mongoose = require('mongoose');

const moveToIpd = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        if (!appointmentId) return errorResponse(res, 'Appointment ID is required');

        // Find the appointment
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 'Appointment not found');
        }

        // Find the appointment details
        const appointmentDetail = await AppointmentDetail.findOne({ appointmentId: appointmentId });

        // Check if already moved to IPD
        const existingIpd = await IPD.findOne({ appointmentId: appointmentId });
        if (existingIpd) {
            return errorResponse(res, 'Appointment already moved to IPD');
        }

        // Create IPD record with all appointment data
        const ipdData = {
            appointmentId: appointment._id,
            appointmentDetailId: appointmentDetail ? appointmentDetail._id : null,

            // Patient and doctor information
            userId: appointment.userId,
            appointmentuserId: appointmentDetail ? appointmentDetail.userId : null,
            doctorId: appointment.doctorId,
            hospitalId: appointment.hospitalId,

            // Patient basic info
            fullName: appointment.fullName,
            mobileNumber: appointment.mobileNumber,

            // IPD specific fields
            ipdAdmissionDate: new Date(),
            ipdStatus: 'Admitted',
        };

        // Another method to create and save the IPD record
        const newIpd = await IPD.create(ipdData);

        // Update appointment detail status if it exists
        if (appointmentDetail) {
            appointmentDetail.status = 'Completed';
            appointmentDetail.update = new Date();
            await appointmentDetail.save();
        }

        return successResponse(res, 'Appointment moved to IPD successfully', {
            ipdId: newIpd._id,
            patientName: appointment.fullName,
            bedNumber: newIpd.bedNumber,
            wardType: newIpd.wardType,
            admissionDate: newIpd.ipdAdmissionDate,
            appointmentId: appointment._id,
            appointmentDetailId: appointmentDetail ? appointmentDetail._id : null,
        });
    } catch (error) {
        console.error('Error moving to IPD:', error);
        return errorResponse(res, 'Error moving to IPD: ' + error.message);
    }
}

const addIpdInstructionByDoctor = async (req, res) => {
    try {
        const { 
            doctorId, 
            ipdId, 
            complaints,
            prescriptions,
            labInvestigations,
            advice,
            remarks,
            totalDays = 15
        } = req.body;

        // Check if IPD record exists
        const ipd = await IPD.findById(ipdId);
        if (!ipd) {
            return errorResponse(res, 'IPD patient not found');
        }

        // Handle file upload if exists
        let labReportPath = '';
        if (req.file && req.file.publicUrl) {
            // Use the public URL set by the upload middleware
            labReportPath = req.file.publicUrl;
            console.log('Using uploaded file:', labReportPath);
        }

        // Parse prescriptions if it's a string (for form-data)
        let parsedPrescriptions = [];
        if (prescriptions) {
            try {
                parsedPrescriptions = typeof prescriptions === 'string' 
                    ? JSON.parse(prescriptions) 
                    : prescriptions;
            } catch (e) {
                console.error('Error parsing prescriptions:', e);
                return errorResponse(res, 'Invalid prescriptions format');
            }
        }

        const ipdDetailsData = {
            ipdId: ipd._id,
            doctorId: doctorId || ipd.doctorId,
            instructionDate: new Date(),
            complaints: complaints || '',
            prescriptions: parsedPrescriptions,
            labInvestigations: labInvestigations || '',
            labReportFile: labReportPath,
            advice: advice || '',
            remarks: remarks || '',
            totalDays: parseInt(totalDays) || 15
        };

        const newIpdDetails = await IpdDetail.create(ipdDetailsData);
        
        return successResponse(res, 'Prescription added successfully', newIpdDetails);
    } catch (error) {
        console.error('Error adding prescription:', error);
        return errorResponse(res, 'Error adding prescription: ' + error.message);
    }
}

const getIpdDetails = async (req, res) => {
    try {
        const ipdId = req.params.ipdId;
        const ipdDetails = await IpdDetail.find({ ipdId: ipdId, delete: false })
            .sort({ create: -1 });

        return successResponse(res, 'Ipd details retrieved successfully', ipdDetails);
    } catch (error) {
        console.error('Error getting IPD details:', error);
        return errorResponse(res, 'Error getting IPD details: ' + error.message);
    }
}

const dischargePatient = async (req, res) => {
    try {
        const { ipdId } = req.body;

        const ipdPatient = await IPD.findById(ipdId);
        if (!ipdPatient) {
            return errorResponse(res, 'IPD patient not found');
        }

        if (ipdPatient.ipdStatus === 'Discharged') {
            return errorResponse(res, 'Patient already discharged');
        }

        // Update IPD record with discharge information
        ipdPatient.ipdStatus = 'Discharged';
        ipdPatient.ipdDischargeDate = new Date();
        ipdPatient.update = new Date();

        await ipdPatient.save();

        return successResponse(res, 'Patient discharged successfully', {
            ipdId: ipdPatient._id,
            patientName: ipdPatient.fullName,
            dischargeDate: ipdPatient.ipdDischargeDate,
            status: ipdPatient.ipdStatus
        });
    } catch (error) {
        console.error('Error discharging patient:', error);
        return errorResponse(res, 'Error discharging patient: ' + error.message);
    }
}

const getAllIpdPatients = async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'Admitted' } = req.query;
        const skip = (page - 1) * limit;

        const filter = { delete: false };
        if (status) {
            filter.ipdStatus = status;
        }

        const ipdPatients = await IPD.find(filter)
            .populate('doctorId', 'name specialization')
            .populate('hospitalId', 'name')
            .sort({ ipdAdmissionDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await IPD.countDocuments(filter);

        return successResponse(res, 'IPD patients retrieved successfully', {
            patients: ipdPatients,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalRecords: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting IPD patients:', error);
        return errorResponse(res, 'Error retrieving IPD patients: ' + error.message);
    }
};

const getAllIpd = async (req, res) => {
    try {
        const ipdPatients = await IPD.find({ ipdStatus : { $ne : 'Discharged' }, delete: false })
            .populate('doctorId', 'name specialization')
            .populate('hospitalId', 'name')
            .sort({ ipdAdmissionDate: -1 });

        return successResponse(res, 'IPD patients retrieved successfully', ipdPatients);
    } catch (error) {
        console.error('Error getting IPD patients:', error);
        return errorResponse(res, 'Error retrieving IPD patients: ' + error.message);
    }
};

const getAllDischargedIpd = async (req, res) => {
    try {
        const ipdPatients = await IPD.find({ ipdStatus : 'Discharged', delete: false })
            .populate('doctorId', 'name specialization')
            .populate('hospitalId', 'name')
            .sort({ ipdAdmissionDate: -1 });

        return successResponse(res, 'IPD patients retrieved successfully', ipdPatients);
    } catch (error) {
        console.error('Error getting IPD patients:', error);
        return errorResponse(res, 'Error retrieving IPD patients: ' + error.message);
    }
};

// Get single IPD patient details
const getIpdPatientById = async (req, res) => {
    try {
        const { ipdId } = req.params;

        const ipdPatient = await IPD.findById(ipdId)
            .populate('doctorId', 'name specialization phone email')
            .populate('hospitalId', 'name address phone')
            .populate('appointmentId')
            .populate('appointmentDetailId');

        if (!ipdPatient) {
            return errorResponse(res, 'IPD patient not found');
        }

        return successResponse(res, 'IPD patient details retrieved successfully', ipdPatient);
    } catch (error) {
        console.error('Error getting IPD patient:', error);
        return errorResponse(res, 'Error retrieving IPD patient: ' + error.message);
    }
};

// Update IPD patient informationdischargeDate
const updateIpdPatient = async (req, res) => {
    try {
        const { ipdId } = req.params;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData.appointmentId;
        delete updateData.appointmentDetailId;
        delete updateData._id;
        delete updateData.create;

        updateData.update = new Date();

        const updatedIpd = await IPD.findByIdAndUpdate(
            ipdId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedIpd) {
            return errorResponse(res, 'IPD patient not found');
        }

        return successResponse(res, 'IPD patient updated successfully', updatedIpd);
    } catch (error) {
        console.error('Error updating IPD patient:', error);
        return errorResponse(res, 'Error updating IPD patient: ' + error.message);
    }
};

// Discharge IPD patient
const dischargeIpdPatient = async (req, res) => {
    try {
        const { ipdId } = req.params;
        const { dischargeDate, dischargeRemarks, finalDiagnosis, dischargeMedications } = req.body;

        const ipdPatient = await IPD.findById(ipdId);
        if (!ipdPatient) {
            return errorResponse(res, 'IPD patient not found');
        }

        if (ipdPatient.ipdStatus === 'Discharged') {
            return errorResponse(res, 'Patient already discharged');
        }

        // Update IPD record with discharge information
        ipdPatient.ipdStatus = 'Discharged';
        ipdPatient.ipdDischargeDate = dischargeDate || new Date();
        ipdPatient.doctorRemarks = dischargeRemarks || ipdPatient.doctorRemarks;
        ipdPatient.probableDiagnosis = finalDiagnosis || ipdPatient.probableDiagnosis;
        ipdPatient.prescriptionList = dischargeMedications || ipdPatient.prescriptionList;
        ipdPatient.update = new Date();

        await ipdPatient.save();

        return successResponse(res, 'Patient discharged successfully', {
            ipdId: ipdPatient._id,
            patientName: ipdPatient.fullName,
            dischargeDate: ipdPatient.ipdDischargeDate,
            status: ipdPatient.ipdStatus
        });
    } catch (error) {
        console.error('Error discharging patient:', error);
        return errorResponse(res, 'Error discharging patient: ' + error.message);
    }
};

const getAllIpdInstructions = async (req, res) => {
    try {
        const ipdId = req.params.ipdId;
        const ipdInstructions = await IpdDetail.find({ ipdId: ipdId, delete: false })
            .sort({ create: -1 });

        return successResponse(res, 'Ipd instructions retrieved successfully', ipdInstructions);
    } catch (error) {
        console.error('Error getting IPD instructions:', error);
        return errorResponse(res, 'Error getting IPD instructions: ' + error.message);
    }
}

module.exports = {
    moveToIpd,
    addIpdInstructionByDoctor,
    getIpdDetails,
    dischargePatient,
    getAllIpdPatients,
    getIpdPatientById,
    updateIpdPatient,
    getAllIpd,
    getAllDischargedIpd,
    dischargeIpdPatient,
    getAllIpdInstructions
}
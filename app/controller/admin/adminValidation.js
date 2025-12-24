const Joi = require('joi');
const appointment = require('../../model/appointment');

const addEditAdmin = Joi.object({
    fullName: Joi.string().required().messages({
        'string.empty': 'Full name is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Valid email is required',
        'string.empty': 'Email is required'
    }),
    password: Joi.string().min(6).optional().messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.empty': 'Password is required'
    }),
    mobileNumber: Joi.string().required(),
    address: Joi.string().optional(),
    dob: Joi.date().optional(),
    gender: Joi.string().valid("MALE", "FEMALE", "OTHER").optional(),
    stateId: Joi.string().optional(),
    cityId: Joi.string().optional(),
    zipCode: Joi.string().optional(),
    profile: Joi.string().optional(),

    adminId: Joi.string().optional()
});

const login = Joi.object({
    loginField: Joi.string().required().messages({
        'string.empty': 'Email or mobile number is required'
    }),
    password: Joi.string().required().messages({
        'string.empty': 'Password is required'
    })
});

const hospitalLogin = Joi.object({
    loginField: Joi.string().required().messages({
        'string.empty': 'Email or mobile number is required'
    }),
    password: Joi.string().required().messages({
        'string.empty': 'Password is required'
    })
});

const editAppointmentDetails = Joi.object({
    appointmentId: Joi.string().required().messages({
        'any.required': 'Appointment Id is required',
        'base.string': 'Appointment Id is must be string'
    }),
    chiefComplaints: Joi.string().optional().messages({
        'any.required': 'Chief Complaints is required',
        'base.string': 'Chief Complaints is must be string'
    }).allow(null, ""),
    doctorRemarks: Joi.string().optional().messages({
        'any.required': 'doctorRemarks is required',
        'base.string': 'doctorRemarks is must be string'
    }).allow(null, ""),
    nextAppointmentDate: Joi.string().optional().messages({
        'any.required': 'nextAppointmentDate is required',
        'base.string': 'nextAppointmentDate is must be string'
    }).allow(null, ""),
    labInvestigations: Joi.string().optional().messages({
        'any.required': 'labInvestigations is required',
        'base.string': 'labInvestigations is must be string'
    }).allow(null, ""),
    prescriptionList: Joi.string().optional().messages({
        'any.required': 'prescriptionList is required',
        'base.string': 'prescriptionList is must be string'
    }).allow(null, ""),
    probableDiagnosis: Joi.string().optional().messages({
        'any.required': 'probableDiagnosis is required',
        'base.string': 'probableDiagnosis is must be string'
    }).allow(null, ""),
    chiefComplaints: Joi.string().optional().messages({
        'any.required': 'chiefComplaints is required',
        'base.string': 'chiefComplaints is must be string'
    }).allow(null, ""),
    labReportFile: Joi.string().optional().messages({
        'any.required': 'labReportFile is required',
        'base.string': 'labReportFile is must be string'
    }).allow(null, ""),
});

module.exports = {
    addEditAdmin,
    login,
    hospitalLogin,
    editAppointmentDetails
};
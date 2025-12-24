const moment = require("moment");
const appointmentdetailModel = require("../model/appointmentdetail");
const { sendWhatsAppMessages } = require("./whatsappService");
const appointmentModel = require("../model/appointment");
const mongoose = require("mongoose");

async function shiftAppointments(doctorId, appointmentDate, startTime, endTime, avgSlotDuration = 30) {
    // 1. Fetch all non-deleted appointments for that doctor & date
    let appointments = await appointmentdetailModel.find({
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        delete: false
    }).sort({ appointmentTime: 1 });

    if (!appointments.length) return;

    // 2. Convert times to minutes since midnight for easier calculations
    const parseTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    let currentTime = parseTime(startTime);
    const endMinutes = parseTime(endTime);
    const slotDuration = Math.min(avgSlotDuration, endMinutes - currentTime); // Ensure we don't exceed the time range

    if (slotDuration <= 0) return; // Invalid time range

    // 3. Generate time slots considering the exact duration
    const slots = [];
    while (currentTime + slotDuration <= endMinutes) {
        const hours = Math.floor(currentTime / 60).toString().padStart(2, '0');
        const minutes = (currentTime % 60).toString().padStart(2, '0');
        slots.push(`${hours}:${minutes}`);
        currentTime += slotDuration;
    }

    if (slots.length === 0) return; // No valid slots found

    // 4. Sort appointments by original time
    appointments.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));

    // 5. Assign appointments to slots
    for (let i = 0; i < Math.min(slots.length, appointments.length); i++) {
        const slot = slots[i];
        const appt = appointments[i];

        // Update the appointment with the new time slot
        await appointmentdetailModel.findByIdAndUpdate(
            appt._id,
            {
                $set: {
                    appointmentTime: slot,
                    update: new Date()
                }
            }
        );

        const appointmentDetails = await getAppointmentDetails(appt.appointmentId);
        const bookingTimeForWhatsApp = formatBookingTime(appointmentDetails.appointmentDate, appointmentDetails.appointmentTime);
        const whatsappMessageData = {
            patientName: appointmentDetails.patient.fullName,
            doctorName: appointmentDetails.doctor.name,
            hospitalAddress: appointmentDetails.hospital.address + ", " + appointmentDetails.hospital.city + ", " + appointmentDetails.hospital.state + ", " + appointmentDetails.hospital.pincode,
            bookingTime: bookingTimeForWhatsApp
        }
        await sendWhatsAppMessages("shiftAppointment", [appt.mobileNumber], whatsappMessageData);
        console.log(`Updated appointment ${appt._id} to slot ${slot}`);
    }
}

function formatBookingTime(bookingDate, bookingTime) {
    // Convert date into "12-July" format
    const dateObj = new Date(bookingDate);
    const options = { day: '2-digit', month: 'long', year: 'numeric' }; // Example: 10 September 2025
    const formattedDate = dateObj.toLocaleDateString('en-GB', options);

    bookingTime = moment(bookingTime, "HH:mm").format("hh:mm A");

    // Final booking datetime string
    const bookingTimeForWhatsApp = `${formattedDate} at ${bookingTime}`;
    return bookingTimeForWhatsApp;
}

const getAppointmentDetails = async (appointmentId) => {
    try {
        const result = await appointmentModel.aggregate([
            // Match the appointment
            { $match: { _id: new mongoose.Types.ObjectId(appointmentId) } },

            // Lookup appointment details
            {
                $lookup: {
                    from: 'appointmentdetails',
                    localField: '_id',
                    foreignField: 'appointmentId',
                    as: 'appointmentDetails'
                }
            },
            { $unwind: '$appointmentDetails' },

            // Lookup user (patient) information
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'patient'
                }
            },
            { $unwind: '$patient' },

            // Lookup doctor information
            {
                $lookup: {
                    from: 'doctors',
                    localField: 'doctorId',
                    foreignField: '_id',
                    as: 'doctor'
                }
            },
            { $unwind: '$doctor' },

            // Lookup hospital information
            {
                $lookup: {
                    from: 'hospitals',
                    localField: 'hospitalId',
                    foreignField: '_id',
                    as: 'hospital'
                }
            },
            { $unwind: '$hospital' },

            // Project only necessary fields
            {
                $project: {
                    _id: 1,
                    appointmentDate: '$appointmentDetails.appointmentDate',
                    appointmentTime: '$appointmentDetails.appointmentTime',
                    cancelReason: '$appointmentDetails.cancelReason',
                    status: '$appointmentDetails.status',
                    isEmergency: '$appointmentDetails.isEmergency',
                    disease: '$appointmentDetails.disease',
                    chiefComplaints: '$appointmentDetails.chiefComplaints',
                    probableDiagnosis: '$appointmentDetails.probableDiagnosis',
                    doctorRemarks: '$appointmentDetails.doctorRemarks',

                    patient: {
                        _id: '$patient._id',
                        fullName: '$patient.fullName',
                        mobileNumber: '$patient.mobileNumber',
                        email: '$patient.email',
                        gender: '$patient.gender',
                        dob: '$patient.dob'
                    },

                    doctor: {
                        _id: '$doctor._id',
                        name: '$doctor.name',
                        specialization: '$doctor.specialization',
                        mobileNumber: '$doctor.mobileNumber',
                        email: '$doctor.email'
                    },

                    hospital: {
                        _id: '$hospital._id',
                        name: '$hospital.name',
                        address: '$hospital.address',
                        city: '$hospital.city',
                        state: '$hospital.state',
                        pincode: '$hospital.pincode',
                        mobileNumber: '$hospital.mobileNumber'
                    }
                }
            }
        ]);

        return result[0] || null;
    } catch (error) {
        console.error('Error fetching appointment details:', error);
        throw error;
    }
};

const setDoctorWorkingHour = async (workingHours) => {
    // Default working hours template
    const defaultWorkingHours = {
        start: "09:00",
        end: "17:00",
        isAvailable: true,
        breaks: [
            {
                start: "13:00",
                end: "14:00",
                name: "Lunch Break"
            }
        ]
    };

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // If workingHours is not provided, initialize as empty object
    if (!workingHours || Object.keys(workingHours).length === 0) {
        workingHours = {};
    }

    // Check if workingHours has direct properties (start/end) instead of day-wise configuration
    const hasGlobalHours = workingHours.start && workingHours.end;

    if (hasGlobalHours) {
        // Use the same working hours for all weekdays
        const globalBreaks = Array.isArray(workingHours.breaks) ? workingHours.breaks : defaultWorkingHours.breaks;

        days.forEach(day => {
            workingHours[day] = {
                start: workingHours.start,
                end: workingHours.end,
                isAvailable: workingHours.isAvailable !== undefined
                    ? workingHours.isAvailable
                    : (day !== 'saturday' && day !== 'sunday'),
                breaks: [...globalBreaks] // Create a new array to avoid reference issues
            };
        });
    } else {
        // Handle day-wise configuration
        days.forEach(day => {
            if (!workingHours[day]) {
                workingHours[day] = {
                    ...defaultWorkingHours,
                    isAvailable: (day !== 'saturday' && day !== 'sunday')
                };
            } else {
                workingHours[day] = {
                    start: workingHours[day].start || defaultWorkingHours.start,
                    end: workingHours[day].end || defaultWorkingHours.end,
                    isAvailable: workingHours[day].isAvailable !== undefined
                        ? workingHours[day].isAvailable
                        : (day !== 'saturday' && day !== 'sunday'),
                    breaks: Array.isArray(workingHours[day].breaks)
                        ? workingHours[day].breaks
                        : [...defaultWorkingHours.breaks]
                };
            }
        });
    }
    return workingHours;
};

const isWithinWorkingHours = (date, startTime, endTime, workingHours) => {
    // Combine the date and time for accurate timezone handling
    const appointmentDateStartTime = moment(`${date} ${startTime}`);
    const appointmentDateEndTime = moment(`${date} ${endTime}`);
    const startMoment = moment(`${date} ${workingHours.start}`);
    const endMoment = moment(`${date} ${workingHours.end}`);
    
    // Check if time is within working hours
    if (!appointmentDateStartTime.isBetween(startMoment, endMoment, null, '[]') || !appointmentDateEndTime.isBetween(startMoment, endMoment, null, '[)')) {
        return false;
    }
    
    // Check if time falls within any break
    let isWithinAnyBreak = false;
    if (workingHours.breaks && workingHours.breaks.length > 0) {
        isWithinAnyBreak = workingHours.breaks.some(breakTime => {
            const breakStart = moment(`${date} ${breakTime.start}`);
            const breakEnd = moment(`${date} ${breakTime.end}`);
            // Check if appointment starts or ends during break (exclusive end for break)
            return appointmentDateStartTime.isBetween(breakStart, breakEnd, null, '[)') || 
                   (appointmentDateEndTime.isAfter(breakStart) && appointmentDateEndTime.isBefore(breakEnd)) ||
                   (appointmentDateStartTime.isSameOrBefore(breakStart) && appointmentDateEndTime.isAfter(breakEnd));
        });
    }
    
    if (isWithinAnyBreak) {
        return false;
    }
    
    return true;
};


module.exports = { shiftAppointments, formatBookingTime, getAppointmentDetails, setDoctorWorkingHour, isWithinWorkingHours };

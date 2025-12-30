const moment = require('moment');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const adminModel = require('../../model/admin');
const appointmentModel = require('../../model/appointment');
const appointmentdetailModel = require('../../model/appointmentdetail');
const hospitalModel = require('../../model/hospital');
const doctorModel = require('../../model/doctor');
const settingModel = require('../../model/setting');
const userModel = require('../../model/user');
const checkOutModel = require('../../model/checkout');
const mediaModel = require('../../model/media');
const contentModel = require('../../model/content');
const bannerModel = require('../../model/banner');
const mongoose = require("mongoose");
const { shiftAppointments, formatBookingTime, getAppointmentDetails, setDoctorWorkingHour, isWithinWorkingHours } = require('../../helper/appointmentHelper');
const { sendWhatsAppMessages } = require('../../helper/whatsappService');
const { sendOTP } = require('../../helper/otpService');
const { successResponse, errorResponse, saveModel, selectdata, selectdatv2, updateModel, selectdatawithjoin } = require('../../helper/index');
const appointmentdetail = require('../../model/appointmentdetail');

const test = async (req, res) => {
    try {
        return successResponse(res, 'Test api call successfully', []);

    } catch (err) {
        console.log('Error in test:', err);
        return errorResponse(res, 'Error in test');
    }
}

// POST route to create or edit an admin
const addEditAdmin = async (req, res) => {
    let adminId = req.body.adminId || "";
    let fullName = req.body.fullName || "";
    let mobileNumber = req.body.mobileNumber || "";
    let gender = req.body.gender || "";
    let email = req.body.email || "";
    let address = req.body.address || "";
    let stateId = req.body.stateId || "";
    let cityId = req.body.cityId || "";
    let zipCode = req.body.zipCode || "";
    let password = req.body.password || "";
    let profile = req.file ? `admin/profiles/${req.file.filefullName}` : req.body.profile || "";

    try {
        let field = {
            fullName, mobileNumber, address, email, gender, stateId, cityId, zipCode
        };
        if (profile) {
            field.profile = profile;
        }

        if (adminId) {
            // Edit existing admin
            let admin = await adminModel.findById(adminId);
            if (!admin) {
                return errorResponse(res, 'Admin not found');
            }

            // Check if email or mobile number already exists for another admin
            let existingAdmin = await adminModel.findOne({
                $or: [{ email }, { mobileNumber }],
                _id: { $ne: adminId }
            });
            if (existingAdmin) {
                return errorResponse(res, 'Admin with this email or mobile number already exists');
            }

            field.update = new Date();
            const updatedAdmin = await updateModel(adminModel, { _id: adminId }, field);
            return successResponse(res, 'Admin updated successfully', updatedAdmin);
        } else {
            // Check if email or mobile number already exists
            let existingAdmin = await adminModel.findOne({ $or: [{ email }, { mobileNumber }] });
            if (existingAdmin) {
                return errorResponse(res, 'Admin with this email or mobile number already exists');
            }

            // Hash the password using MD5
            field.password = md5(password);
            const savedAdmin = await saveModel(adminModel, field);
            return successResponse(res, 'Admin created successfully', savedAdmin);
        }
    } catch (error) {
        console.error('Error creating/updating admin:', error);
        return errorResponse(res, 'Error creating/updating admin');
    }
}

// login 
const login = async (req, res) => {
    let loginField = req.body.loginField || "";
    let password = req.body.password || "";

    try {
        const admin = await adminModel.findOne({
            $or: [{ email: loginField }, { mobileNumber: loginField }],
            delete: false,
            password: md5(password)
        });
        if (!admin) {
            return errorResponse(res, 'Invalid Valide credentials');
        }

        return successResponse(res, 'Login successful', admin);
    } catch (error) {
        console.error('Error logging in:', error);
        return errorResponse(res, 'Error logging in');
    }
}

const hospitalLogin = async (req, res) => {
    let loginField = req.body.loginField || "";
    let password = req.body.password || "";

    try {
        const hospital = await hospitalModel.findOne({
            $or: [{ email: loginField }, { mobileNumber: loginField }],
            delete: false,
            password: md5(password)
        });
        if (!hospital) {
            return errorResponse(res, 'Invalid Valide credentials');
        }

        return successResponse(res, 'Login successful', hospital);
    } catch (error) {
        console.error('Error logging in:', error);
        return errorResponse(res, 'Error logging in');
    }
}

// admin profile
const adminProfile = async (req, res) => {
    const adminId = req.body.adminId || "";
    const limit = req.body.limit || 0;
    const offset = req.body.offset || 0;
    const searchQuery = req.body.searchQuery || "";

    try {
        let field = `fullName email mobileNumber address profile`;
        let data = await selectdatv2(adminModel, { _id: adminId, delete: false }, field, limit, offset, field, searchQuery, { createdAt: -1 });
        if (data.length == 0) {
            return errorResponse(res, 'Admin not found');
        }
        return successResponse(res, 'Admin profile fetched successfully', data, true);
    } catch (error) {
        console.error('Error fetching admin profile:', error);
        return errorResponse(res, 'Error fetching admin profile');
    }
}

// add hostpital
const addHospital = async (req, res) => {
    try {
        const {
            ownerName,
            socialMediaLinks = '',
            name = '',
            type,
            email,
            mobileNumber = '',
            address = '',
            city = '',
            state = '',
            pincode = '',
            latitude = '',
            longitude = '',
            content = '[]',
            password = '',
            specialization,
        } = req.body;
        let otherSpecialization = req.body.otherSpecialization || "";

        let profile = [];
        let images = [];
        if (req.files) {
            profile = req.files['profile'] || [];
            images = req.files['images'] || [];
        }

        let contentJson = [];
        try {
            contentJson = content ? JSON.parse(content) : [];
        } catch (e) {
            console.error('Error parsing content JSON:', e);
            contentJson = [];
        }

        let specializations = [];
        const specializationModel = require('../../model/specialization');

        if (type === 'Multispeciality' && Array.isArray(specialization)) {
            specializations = specialization;
        } else if (type === 'Speciality' && specialization) {
            specializations = specialization;
        } else if (type === 'Other' && otherSpecialization) {
            try {
                otherSpecialization = otherSpecialization;
            } catch (error) {
                console.error('Error creating custom specialization:', error);
                return errorResponse(res, 'Error creating custom specialization');
            }
        }

        // Check if a hospital with the same email already exists
        const existingHospital = await hospitalModel.findOne({ email });
        if (existingHospital) {
            return errorResponse(res, 'Hospital with this email already exists');
        }

        // Prepare hospital data
        const hospitalData = {
            ownerName,
            socialMediaLinks,
            name,
            email,
            mobileNumber,
            address,
            city,
            state,
            pincode,
            latitude,
            longitude,
            type,
            specialization: specializations, // Store array of specialization IDs
            otherSpecialization, // Store custom text if any
            content: contentJson,
            password: password ? md5(password) : undefined
        };
        if (profile.length != 0) {
            hospitalData['profile'] = `admin/profiles/` + profile[0]['filename']
        }
        const newHospital = await hospitalModel.create(hospitalData);

        // image store
        for (let m = 0; m < images.length; m++) {
            // console.log("images[m]['filename']",images[m]['filename']);

            // let imagess = await mediaModel.create({ image: `admin/profiles/` + images[m]['filename'], type: 'HOSPITAL', typeId: newHospital['_id'] });
            await mediaModel.create({ image: images[m]['path'], type: 'HOSPITAL', typeId: newHospital['_id'] });
        }

        for (let c = 0; c < contentJson.length; c++) {

            let saveObj = { image: contentJson[c]['image'], title: contentJson[c]['title'], description: contentJson[c]['description'], hospitalId: newHospital['_id'] }
            let saveContent = await contentModel.create(saveObj);

        }

        return successResponse(res, 'Hospital created successfully', newHospital);

    } catch (err) {
        console.error('Error creating hospital:', err);
        return errorResponse(res, 'Error creating hospital');
    }
};

// imageUpload
const imageUpload = async (req, res) => {
    try {

        let images = req.files['images'] || []
        let obj = images
        obj['profile'] = images[0]['filename']

        return successResponse(res, 'successfully', obj);

    } catch (err) {
        console.error('Error creating hospital:', err);
        return errorResponse(res, 'Error creating hospital');
    }
};

// get hospitals
// const getHospitals = async (req, res) => {
//     try {
//         const { hospitalId, limit = 10, offset = 0 } = req.body;

//         const condition = { delete: false }; // Only active hospitals

//         if (hospitalId) {
//             condition._id = hospitalId;
//         }

//         const { data: hospitals, totalRecords } = await selectdatawithjoin({
//             Model: hospitalModel,
//             condition,
//             fields: 'ownerName socialMediaLinks name email mobileNumber address profile',
//             limit: parseInt(limit),
//             offset: parseInt(offset),
//             sortBy: { create: -1 }
//         });

//         return successResponse(res, 'Hospitals fetched successfully', {
//             totalRecords,
//             hospitals
//         });
//     } catch (error) {
//         console.error('Error fetching hospitals:', error);
//         return errorResponse(res, 'Error fetching hospitals');
//     }
// };

const getHospitals = async (req, res) => {
    try {
        const { hospitalId, latitude, longitude, distance = 10, limit = 10, city = '', state = '', offset = 0 } = req.body;

        const condition = { delete: false }; // Only active hospitals

        if (hospitalId) {
            condition._id = hospitalId;
        }

        // If latitude and longitude are provided, use geolocation query
        if (latitude && longitude) {
            const hospitals = await hospitalModel.aggregate([
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                        distanceField: "distance",
                        maxDistance: parseFloat(distance) * 1000, // convert km to meters
                        spherical: true,
                        query: condition
                    }
                },
                { $sort: { distance: 1 } }, // nearest first
                { $skip: parseInt(offset) },
                { $limit: parseInt(limit) },
                {
                    $project: {
                        ownerName: 1,
                        socialMediaLinks: 1,
                        name: 1,
                        email: 1,
                        mobileNumber: 1,
                        address: 1,
                        profile: 1,
                        distance: 1
                    }
                }
            ]);

            const totalRecords = hospitals.length;

            return successResponse(res, 'Hospitals fetched successfully', {
                totalRecords,
                hospitals
            });
        } else {
            // fallback normal if lat/long not provided
            // let query = hospitalModel.find(condition)
            //     .select('ownerName socialMediaLinks name email mobileNumber address profile content city')
            //     .sort({ create: -1 });

            // // If city is provided, fetch all hospitals and sort by city match
            // if (city) {
            // const allHospitals = await query.lean();

            // // Sort hospitals: matching city first, then others
            // const sortedHospitals = allHospitals.sort((a, b) => {
            //     const aMatch = a.city?.toLowerCase() === city.toLowerCase();
            //     const bMatch = b.city?.toLowerCase() === city.toLowerCase();

            //     if (aMatch && !bMatch) return -1;
            //     if (!aMatch && bMatch) return 1;
            //     return 0;
            // });

            // // Apply pagination
            // const hospitals = sortedHospitals.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
            // const totalRecords = allHospitals.length;

            // for (let h = 0; h < hospitals.length; h++) {

            // let contentArr = await contentModel.find({ delete: false, hospitalId: hospitals[h]['_id'] })
            // hospitals[h]['contentDetails'] = contentArr
            // console.log("contentArr", contentArr);

            // fallback normal if lat/long not provided
            let query = hospitalModel.find(condition)
                .select('ownerName socialMediaLinks name email mobileNumber address profile content city');

            // Fetch all hospitals
            const allHospitals = await query.lean();

            if (city) {
                // Separate hospitals into matching city and others
                const cityHospitals = allHospitals
                    .filter(h => h.city?.toLowerCase() === city.toLowerCase());

                const otherHospitals = allHospitals
                    .filter(h => h.city?.toLowerCase() !== city.toLowerCase())
                    .sort((a, b) => a.city?.localeCompare(b.city)); // abc order

                // Combine
                const sortedHospitals = [...cityHospitals, ...otherHospitals];

                // Apply pagination
                const hospitals = sortedHospitals.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
                const totalRecords = allHospitals.length;

                // Attach content details
                for (let h = 0; h < hospitals.length; h++) {
                    let contentArr = await contentModel.find({ delete: false, hospitalId: hospitals[h]._id });
                    hospitals[h].contentDetails = contentArr;
                }

                return successResponse(res, 'Hospitals fetched successfully', {
                    totalRecords,
                    hospitals
                }, true);
            } else {
                // No city → default abc sorting
                const sortedHospitals = allHospitals.sort((a, b) => a.city?.localeCompare(b.city));

                const hospitals = sortedHospitals.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
                const totalRecords = allHospitals.length;

                for (let h = 0; h < hospitals.length; h++) {
                    let contentArr = await contentModel.find({ delete: false, hospitalId: hospitals[h]._id });
                    hospitals[h].contentDetails = contentArr;
                }

                return successResponse(res, 'Hospitals fetched successfully', {
                    totalRecords,
                    hospitals
                }, true);
            }

        }
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        return errorResponse(res, 'Error fetching hospitals');
    }
}

// add doctor
const addDoctor = async (req, res) => {
    try {
        const {
            name,
            email,
            mobileNumber = "",
            specializationId = "",
            degreeId = "",
            hospitalId = "",
            address = "",
            appointmentCharge = "",
            averageAppointmentTime = "",
            experience = "",
            age,
            gender } = req.body;

        let workingHours = req.body.workingHours || {};
        const profile = req.file ? `profiles/${req.file.filefullName}` : req.body.profile || "";

        if (!name || !email || !age || !gender) {
            return errorResponse(res, "Name, email, age, and gender are required");
        }

        const existingDoctor = await doctorModel.findOne({ email });
        if (existingDoctor) {
            return errorResponse(res, "Doctor with this email already exists");
        }

        workingHours = await setDoctorWorkingHour(workingHours);

        const doctorData = {
            name,
            email,
            mobileNumber,
            specializationId,
            degreeId,
            hospitalId,
            address,
            appointmentCharge,
            averageAppointmentTime,
            experience,
            profile,
            age,
            gender,
            workingHours
        };

        const newDoctor = await doctorModel.create(doctorData);
        return successResponse(res, "Doctor created successfully", newDoctor);

    } catch (err) {
        console.error("Error creating doctor:", err);
        return errorResponse(res, "Error creating doctor");
    }
};

// get doctors
const getDoctors = async (req, res) => {
    try {
        const { doctorId, hospitalId, limit = 10, offset = 0 } = req.body;

        const condition = { delete: false }; // Only active doctors

        if (doctorId) {
            condition._id = doctorId;
        }
        if (hospitalId) {
            condition.hospitalId = hospitalId;
        }

        const { data: doctors, totalRecords } = await selectdatawithjoin({
            Model: doctorModel,
            condition,
            fields: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge averageAppointmentTime experience profile age gender',
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: { create: -1 },
            joinModel: [
                { path: 'specializationId', select: 'name' },
                { path: 'degreeId', select: 'name' },
                { path: 'hospitalId', select: 'name email mobileNumber address' }
            ]
        });

        return successResponse(res, 'Doctors fetched successfully', {
            totalRecords,
            doctors
        });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        return errorResponse(res, 'Error fetching doctors');
    }
};

// add appointment
// const addAppointment = async (req, res) => {
//     let userId = req.body.userId
//     let mobilenumber = req.body.mobilenumber
//     let fullName = req.body.fullName || ""
//     let doctorId = req.body.doctorId || ""
//     let hospitalId = req.body.hospitalId
//     let appointmentuserId = req.body.appointmentuserId || ""
//     let duration = req.body.duration || ""
//     let disease = req.body.disease || ""
//     let appointmentDate = req.body.appointmentDate || ""
//     let appointmentTime = req.body.appointmentTime || ""
//     let isEmergency = req.body.isEmergency || false

//     try {

//         if (!fullName) {
//             return errorResponse(res, 'Full name is required');
//         }
//         if (!mobilenumber) {
//             return errorResponse(res, 'Mobile number is required');
//         }

//         let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");

//         let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
//         if (!checkMobileNumber) {
//             // add usefr if not exist
//             let userField = {
//                 fullName,
//                 mobileNumber: mobilenumber,
//             }
//             let user = await saveModel(userModel, userField);
//             userId = user._id;
//         } else {
//             userId = checkMobileNumber._id;
//         }

//         let appointmentfield = {
//             userId,
//             mobileNumber: mobilenumber,
//             fullName,
//             hospitalId,
//             create: new Date(),
//         };
//         let appointmentDetailfield = {
//             create: new Date(),
//             userId,
//             disease,
//             duration: durationData.data[0].value,
//             doctorId,
//             appointmentTime,
//             appointmentDate,
//             isEmergency,
//             ...(appointmentuserId && { appointmentuserId: appointmentuserId })
//         }

//         const savedAppointment = await saveModel(appointmentModel, appointmentfield);

//         if (!savedAppointment) {
//             return errorResponse(res, 'Error creating appointment');
//         }

//         appointmentDetailfield.appointmentId = savedAppointment._id;
//         await saveModel(appointmentdetailModel, appointmentDetailfield);

//         return successResponse(res, 'Appointment created successfully', []);

//     } catch (error) {
//         console.error('Error adding appointment:', error);
//         return errorResponse(res, 'Error adding appointment');
//     }
// }

// add appointment Add apoointment
const addAppointment = async (req, res) => {
    let userId = req.body.userId;
    let mobilenumber = req.body.mobilenumber;
    let fullName = req.body.fullName || "";
    let doctorId = req.body.doctorId || "";
    let hospitalId = req.body.hospitalId;
    let appointmentuserId = req.body.appointmentuserId || "";
    let duration = req.body.duration || "";
    let disease = req.body.disease || "";
    let appointmentDate = req.body.appointmentDate || "";
    let appointmentTime = req.body.appointmentTime || "";
    let isEmergency = req.body.isEmergency || false;

    // let appointmentId = req.body.appointmentId;
    // let chiefComplaints = req.body.chiefComplaints || "";
    // let probableDiagnosis = req.body.probableDiagnosis || "";
    // let prescriptionList = req.body.prescriptionList || "";
    // let labInvestigations = req.body.labInvestigations || "";
    // let labReports = req.body.labReports || "";
    // let doctorRemarks = req.body.doctorRemarks || "";

    try {
        // Validation
        if (!fullName) {
            return errorResponse(res, 'Full name is required');
        }
        if (!mobilenumber) {
            return errorResponse(res, 'Mobile number is required');
        }
        if (!appointmentDate) {
            return errorResponse(res, 'Appointment date is required');
        }

        // valide date format YYYY-MM-DD using Date
        if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
            return errorResponse(res, 'Invalid date format. Please use YYYY-MM-DD.');
        }

        let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");

        let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });

        if (!checkMobileNumber) {
            // Add user if not exist
            let userField = {
                fullName,
                mobileNumber: mobilenumber,
            };
            let user = await saveModel(userModel, userField);

            userId = user._id;
        } else {
            userId = checkMobileNumber._id;
        }
        // check doctor detail
        let checkDoc = await doctorModel.find({ delete: false, _id: doctorId, isAvailable: false })

        if (checkDoc.length < 0) {
            return errorResponse(res, 'Doctor is Not Available');
        }

        // Create appointment
        let appointmentfield = {
            userId,
            mobileNumber: mobilenumber,
            fullName,
            hospitalId,
            doctorId,
            create: new Date(),
        };
        const savedAppointment = await saveModel(appointmentModel, appointmentfield);

        if (!savedAppointment) {
            return errorResponse(res, 'Error creating appointment');
        }

        // Create appointment detail
        let appointmentDetailfield = {
            create: new Date(),
            userId,
            disease,
            duration: durationData.data[0]?.value || "",

            appointmentTime,
            appointmentDate,
            isEmergency,
            appointmentId: savedAppointment._id,
        };

        if (appointmentuserId) {
            appointmentDetailfield.appointmentuserId = appointmentuserId;
        }

        await saveModel(appointmentdetailModel, appointmentDetailfield);

        return successResponse(res, 'Appointment created successfully', []);
    } catch (error) {
        console.error('Error adding appointment:', error);
        return errorResponse(res, 'Error adding appointment');
    }
};

// const addAppointment = async (req, res) => {
//     let appointmentId = req.body.appointmentId;
//     let userId = req.body.userId;
//     let mobilenumber = req.body.mobilenumber;
//     let fullName = req.body.fullName || "";
//     let doctorId = req.body.doctorId || "";
//     let hospitalId = req.body.hospitalId;
//     let appointmentuserId = req.body.appointmentuserId || "";
//     let duration = req.body.duration || "";
//     let disease = req.body.disease || "";
//     let appointmentDate = req.body.appointmentDate || "";
//     let appointmentTime = req.body.appointmentTime || "";
//     let isEmergency = req.body.isEmergency || false;

//     let chiefComplaints = req.body.chiefComplaints || "";
//     let probableDiagnosis = req.body.probableDiagnosis || "";
//     let prescriptionList = req.body.prescriptionList || "";
//     let labInvestigations = req.body.labInvestigations || "";
//     let labReports = req.body.labReports || "";
//     let doctorRemarks = req.body.doctorRemarks || "";

//     try {
//         if (!fullName) return errorResponse(res, 'Full name is required');
//         if (!mobilenumber) return errorResponse(res, 'Mobile number is required');
//         if (!appointmentDate) return errorResponse(res, 'Appointment date is required');
//         if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
//             return errorResponse(res, 'Invalid date format. Please use YYYY-MM-DD.');
//         }

//         let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");

//         let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
//         if (!checkMobileNumber) {
//             let user = await saveModel(userModel, { fullName, mobileNumber: mobilenumber });
//             userId = user._id;
//         } else {
//             userId = checkMobileNumber._id;
//         }

//         let checkDoc = await doctorModel.find({ delete: false, _id: doctorId, isAvailable: false });
//         if (checkDoc.length < 0) return errorResponse(res, 'Doctor is Not Available');

//         const appointmentData = {
//             userId,
//             mobileNumber: mobilenumber,
//             fullName,
//             hospitalId,
//             doctorId,
//             update: new Date()
//         };

//         const appointmentDetailData = {
//             userId,
//             disease,
//             duration: durationData.data[0]?.value || "",
//             appointmentTime,
//             appointmentDate,
//             isEmergency,
//             update: new Date()
//         };

//         if (appointmentuserId) {
//             appointmentDetailData.appointmentuserId = appointmentuserId;
//         }

//         if (appointmentId && appointmentId !== "0") {
//             // Update existing appointment
//             const updated = await appointmentModel.findByIdAndUpdate(appointmentId, appointmentData, { new: true });
//             if (!updated) return errorResponse(res, 'Appointment not found or update failed');

//             await appointmentdetailModel.findOneAndUpdate(
//                 { appointmentId },
//                 appointmentDetailData,
//                 { upsert: true, new: true }
//             );

//             return successResponse(res, 'Appointment updated successfully', []);
//         } else {
//             // Create new appointment
//             appointmentData.create = new Date();
//             const savedAppointment = await saveModel(appointmentModel, appointmentData);
//             if (!savedAppointment) return errorResponse(res, 'Error creating appointment');

//             appointmentDetailData.create = new Date();
//             appointmentDetailData.appointmentId = savedAppointment._id;
//             await saveModel(appointmentdetailModel, appointmentDetailData);

//             return successResponse(res, 'Appointment created successfully', []);
//         }
//     } catch (error) {
//         console.error('Error adding/updating appointment:', error);
//         return errorResponse(res, 'Error adding or updating appointment');
//     }
// };

// const addAppointmentV2 = async (req, res) => {
//     let {
//         userId,
//         mobilenumber,
//         fullName = "",
//         doctorId = "",
//         hospitalId,
//         appointmentuserId = "",
//         duration = "",
//         disease = "",
//         appointmentDate = "",
//         appointmentTime = "",
//         isEmergency = false,
//     } = req.body;

//     try {
//         // 🛑 Validation: required fields
//         if (!fullName) return errorResponse(res, 'Full name is required');
//         if (!mobilenumber) return errorResponse(res, 'Mobile number is required');
//         if (!appointmentDate || !appointmentTime) return errorResponse(res, 'Appointment date and time are required');

//         // ✅ Validate date format: YYYY-MM-DD
//         if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
//             return errorResponse(res, 'Invalid date format. Use YYYY-MM-DD');
//         }

//         // ✅ Validate time format: HH:mm:ss
//         if (!/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(appointmentTime)) {
//             return errorResponse(res, 'Invalid time format. Use HH:mm:ss');
//         }

//         // ✅ Get duration value from settings
//         const durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");
//         const finalDuration = parseInt(durationData.data[0]?.value || "30");

//         // ✅ Check if user exists
//         let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
//         if (!checkMobileNumber) {
//             let userField = {
//                 fullName,
//                 mobileNumber: mobilenumber,
//             };
//             let user = await saveModel(userModel, userField);
//             userId = user._id;
//         } else {
//             userId = checkMobileNumber._id;
//         }

//         // ✅ Parse requested appointment time
//         const newStartTime = new Date(`${appointmentDate}T${appointmentTime}`);
//         const newEndTime = new Date(newStartTime.getTime() + finalDuration * 60000);

//         // ✅ Fetch existing appointments for that doctor & date
//         const existingAppointments = await appointmentdetailModel.find({
//             doctorId,
//             appointmentDate,
//             delete: false,
//         });

//         const hasConflict = existingAppointments.some(existing => {
//             const existingStart = new Date(`${existing.appointmentDate}T${existing.appointmentTime}`);
//             const existingDuration = parseInt(existing.duration || "30");
//             const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);

//             return newStartTime < existingEnd && newEndTime > existingStart;
//         });

//         if (hasConflict) {
//             return errorResponse(res, 'This time slot is already booked for the doctor.');
//         }

//         // ✅ Create appointment
//         let appointmentField = {
//             userId,
//             mobileNumber: mobilenumber,
//             fullName,
//             hospitalId,
//             create: new Date(),
//         };

//         const savedAppointment = await saveModel(appointmentModel, appointmentField);
//         if (!savedAppointment) {
//             return errorResponse(res, 'Error creating appointment');
//         }

//         // ✅ Create appointment detail
//         let appointmentDetailField = {
//             create: new Date(),
//             userId,
//             disease,
//             duration: finalDuration.toString(),
//             doctorId,
//             appointmentTime,
//             appointmentDate,
//             isEmergency,
//             appointmentId: savedAppointment._id,
//         };

//         if (appointmentuserId) {
//             appointmentDetailField.appointmentuserId = appointmentuserId;
//         }

//         await saveModel(appointmentdetailModel, appointmentDetailField);

//         return successResponse(res, 'Appointment created successfully', []);
//     } catch (error) {
//         console.error('Error adding appointment:', error);
//         return errorResponse(res, 'Error adding appointment');
//     }
// };





// delete appointment

// controllers/appointmentController.js

// const userModel = require('../models/user');
// const appointmentModel = require('../models/appointment');
// const appointmentdetailModel = require('../models/appointmentdetail');
// const settingModel = require('../models/setting');
// const { saveModel, selectdatv2 } = require('../helpers/dbHelper');
// const { successResponse, errorResponse } = require('../helpers/responseHelper');

// controllers/appointmentController.js


// const addAppointmentV2 = async (req, res) => {
//     let {
//         userId,
//         mobilenumber,
//         fullName = "",
//         doctorId = "",
//         hospitalId,
//         appointmentuserId = "",
//         disease = "",
//         chiefComplaints = "",
//         probableDiagnosis = "",
//         appointmentDate = "",
//         appointmentTime = "",
//         startTime = "",
//         endTime = "",
//         isEmergency = false
//     } = req.body;

//     try {
//         // Validation
//         if (!fullName) return errorResponse(res, 'Full name is required');
//         if (!mobilenumber) return errorResponse(res, 'Mobile number is required');
//         if (!appointmentDate || !appointmentTime || !doctorId) {
//             return errorResponse(res, 'Doctor, appointment date, and time are required');
//         }

//         // Get duration from settings
//         let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");
//         let durationValue = parseInt(durationData?.data?.[0]?.value || "0");
//         let doctor = await doctorModel.findById(doctorId);
//         durationValue = parseInt(doctor?.averageAppointmentTime || "0");

//         // // Calculate time range
//         // const startTime = moment(`${appointmentDate} ${appointmentTime}`, "YYYY-MM-DD HH:mm");
//         // const endTime = moment(startTime).add(durationValue, 'minutes');

//         // // Check for overlapping appointments
//         // const overlappingAppointment = await appointmentdetailModel.findOne({
//         //     doctorId,
//         //     appointmentDate,
//         //     delete: false,
//         //     appointmentTime: {
//         //         $gte: startTime.format("HH:mm"),
//         //         $lt: endTime.format("HH:mm")
//         //     }
//         // });

//         // if (overlappingAppointment.length > 0) {
//         //     return errorResponse(res, 'Selected time slot is already booked.');
//         // }

//         // const startMoment = moment(`${appointmentDate} ${appointmentTime}`, "YYYY-MM-DD HH:mm");
//         // const endMoment = moment(startMoment).add(durationValue, "minutes");

//         // // 1. Get all appointmentDetails for this doctor & date
//         // const bookedAppointments = await appointmentdetailModel.aggregate([
//         //     {
//         //         $lookup: {
//         //             from: "appointments",
//         //             localField: "appointmentId",
//         //             foreignField: "_id",
//         //             as: "appointment"
//         //         }
//         //     },
//         //     { $unwind: "$appointment" },
//         //     {
//         //         $match: {
//         //             "appointment.doctorId": new mongoose.Types.ObjectId(doctorId),
//         //             appointmentDate: new Date(appointmentDate),
//         //             delete: false
//         //         }
//         //     }
//         // ]);

//         // // 2. Loop through existing and check overlap in JS
//         // let isClashing = false;

//         // for (const appt of bookedAppointments) {
//         //     const existingStart = moment(`${appointmentDate} ${appt.appointmentTime}`, "YYYY-MM-DD HH:mm");
//         //     const existingEnd = moment(existingStart).add(doctor.averageAppointmentTime, "minutes");

//         //     if (startMoment.isBefore(existingEnd) && endMoment.isAfter(existingStart)) {
//         //         isClashing = true;
//         //         break;
//         //     }
//         // }

//         // if (isClashing) {
//         //     return errorResponse(res, "Selected time slot is already booked.");
//         // }


//         // Check or create user

//         const startRange = moment(`${appointmentDate} ${appointmentTime}`, "YYYY-MM-DD HH:mm");
//         const endRange = moment(`${appointmentDate} ${endTime}`, "YYYY-MM-DD HH:mm");

//         // doctor slot size
//         const slotSize = parseInt(doctor.averageAppointmentTime || "30");

//         // 1. Get all booked appointments for this doctor & date
//         const bookedAppointments = await appointmentdetailModel.aggregate([
//             {
//                 $lookup: {
//                     from: "appointments",
//                     localField: "appointmentId",
//                     foreignField: "_id",
//                     as: "appointment"
//                 }
//             },
//             { $unwind: "$appointment" },
//             {
//                 $match: {
//                     "appointment.doctorId": new mongoose.Types.ObjectId(doctorId),
//                     appointmentDate: new Date(appointmentDate),
//                     delete: false
//                 }
//             }
//         ]);

//         // Convert booked slots into start–end ranges
//         const bookedRanges = bookedAppointments.map(appt => {
//             const existingStart = moment(`${appointmentDate} ${appt.appointmentTime}`, "YYYY-MM-DD HH:mm");
//             const existingEnd = existingStart.clone().add(slotSize, "minutes");  // ✅ clone before add
//             return { start: existingStart, end: existingEnd };
//         });        

//         // 2. Iterate through requested range in steps of slotSize
//         let chosenSlot = null;
//         let current = startRange.clone();

//         while (current.add(0, "minutes").isBefore(endRange)) {
//             const potentialStart = current.clone();
//             const potentialEnd = current.clone().add(slotSize, "minutes");

//             // make sure slot fits inside requested range
//             if (potentialEnd.isAfter(endRange)) break;

//             // check overlap with any booked slot
//             const overlap = bookedRanges.some(
//                 b => potentialStart.isBefore(b.end) && potentialEnd.isAfter(b.start)
//             );

//             if (!overlap) {
//                 chosenSlot = { start: potentialStart, end: potentialEnd };
//                 break;
//             }

//             // move to next slot
//             current = current.add(slotSize, "minutes");
//         }

//         // 3. Decide
//         if (!chosenSlot) {
//             return errorResponse(res, "No available slot in requested range.");
//         }

//         let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
//         if (!checkMobileNumber) {
//             const user = await saveModel(userModel, {
//                 fullName,
//                 mobileNumber: mobilenumber,
//             });
//             userId = user._id;
//         } else {
//             userId = checkMobileNumber._id;
//         }

//         // Create appointment
//         const appointmentField = {
//             userId,
//             mobileNumber: mobilenumber,
//             fullName,
//             hospitalId,
//             doctorId,
//             create: new Date()
//         };
//         const savedAppointment = await saveModel(appointmentModel, appointmentField);

//         if (!savedAppointment) {
//             return errorResponse(res, 'Error creating appointment');
//         }

//         // Build appointment detail data
//         const appointmentDetailField = {
//             userId,
//             disease,
//             doctorId,
//             duration: `${durationValue}`,
//             appointmentDate,
//             appointmentTime : chosenSlot.start.format("HH:mm"),
//             startTime: startTime ? startTime : appointmentTime,
//             endTime: endTime,
//             chiefComplaints,
//             probableDiagnosis,
//             isEmergency,
//             appointmentId: savedAppointment._id,
//             create: new Date()
//         };

//         // Only add appointmentuserId if it's valid
//         if (appointmentuserId && mongoose.Types.ObjectId.isValid(appointmentuserId)) {
//             appointmentDetailField.appointmentuserId = appointmentuserId;
//         }

//         await saveModel(appointmentdetailModel, appointmentDetailField);

//         return successResponse(res, 'Appointment created successfully', []);
//     } catch (error) {
//         console.error('Error in addAppointmentV2:', error);
//         return errorResponse(res, 'Error adding appointment');
//     }
// };

// const addAppointmentV2 = async (req, res) => {
//     let {
//         userId,
//         mobilenumber,
//         fullName = "",
//         doctorId = "",
//         hospitalId,
//         appointmentuserId = "",
//         disease = "",
//         chiefComplaints = "",
//         probableDiagnosis = "",
//         appointmentDate = "",
//         appointmentTime = "",
//         startTime = "",
//         endTime = "",
//         isEmergency = false
//     } = req.body;

//     try {
//         // Validation
//         if (!fullName) return errorResponse(res, 'Full name is required');
//         if (!mobilenumber) return errorResponse(res, 'Mobile number is required');
//         if (!appointmentDate || !appointmentTime || !doctorId) {
//             return errorResponse(res, 'Doctor, appointment date, and time are required');
//         }

//         // Get duration from settings
//         let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");
//         let durationValue = parseInt(durationData?.data?.[0]?.value || "0");
//         let doctor = await doctorModel.findById(doctorId);
//         durationValue = parseInt(doctor?.averageAppointmentTime || "0");

//         const startRange = moment(`${appointmentDate} ${startTime}`, "YYYY-MM-DD HH:mm");
//         const endRange = moment(`${appointmentDate} ${endTime}`, "YYYY-MM-DD HH:mm");

//         // doctor slot size
//         const slotSize = parseInt(doctor.averageAppointmentTime || "30");

//         // 1. Get all booked appointments for this doctor & date
//         const bookedAppointments = await appointmentdetailModel.aggregate([
//             {
//                 $lookup: {
//                     from: "appointments",
//                     localField: "appointmentId",
//                     foreignField: "_id",
//                     as: "appointment"
//                 }
//             },
//             { $unwind: "$appointment" },
//             {
//                 $match: {
//                     "appointment.doctorId": new mongoose.Types.ObjectId(doctorId),
//                     appointmentDate: new Date(appointmentDate),
//                     delete: false
//                 }
//             }
//         ]);

//         // Convert booked slots into start–end ranges
//         const bookedRanges = bookedAppointments.map(appt => {
//             const existingStart = moment(`${appointmentDate} ${appt.appointmentTime}`, "YYYY-MM-DD HH:mm");
//             const existingEnd = existingStart.clone().add(slotSize, "minutes");  // ✅ clone before add
//             return { start: existingStart, end: existingEnd };
//         });

//         // 2. Iterate through requested range in steps of slotSize
//         let chosenSlot = null;
//         let current = startRange.clone();
//         let totalBookedMinutes = 0;

//         while (current.add(0, "minutes").isBefore(endRange)) {
//             const potentialStart = current.clone();
//             let potentialEnd = current.clone().add(slotSize, "minutes");

//             // make sure slot fits inside requested range
//             if ((60 - totalBookedMinutes) < 3 && potentialEnd.isAfter(endRange)) break;
//             //if potentialEnd > endRange then set potentialEnd to endRnage
//             if(potentialEnd.isAfter(endRange)) potentialEnd = endRange;

//             // check overlap with any booked slot
//             const overlap = bookedRanges.some(
//                 b => potentialStart.isBefore(b.end) && potentialEnd.isAfter(b.start)
//             );

//             if (!overlap) {
//                 chosenSlot = { start: potentialStart, end: potentialEnd };
//                 break;
//             }

//             // move to next slot
//             current = current.add(slotSize, "minutes");
//             totalBookedMinutes += slotSize;
//         }

//         // 3. Decide
//         if (!chosenSlot) {
//             return errorResponse(res, "No available slot in requested range.");
//         }

//         let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
//         if (!checkMobileNumber) {
//             const user = await saveModel(userModel, {
//                 fullName,
//                 mobileNumber: mobilenumber,
//             });
//             userId = user._id;
//         } else {
//             userId = checkMobileNumber._id;
//         }

//         // Create appointment
//         const appointmentField = {
//             userId,
//             mobileNumber: mobilenumber,
//             fullName,
//             hospitalId,
//             doctorId,
//             create: new Date()
//         };
//         const savedAppointment = await saveModel(appointmentModel, appointmentField);

//         if (!savedAppointment) {
//             return errorResponse(res, 'Error creating appointment');
//         }

//         // Build appointment detail data
//         const appointmentDetailField = {
//             userId,
//             disease,
//             doctorId,
//             duration: `${durationValue}`,
//             appointmentDate,
//             appointmentTime: chosenSlot.start.format("HH:mm"),
//             startTime: startTime ? startTime : appointmentTime,
//             endTime: endTime,
//             chiefComplaints,
//             probableDiagnosis,
//             isEmergency,
//             appointmentId: savedAppointment._id,
//             create: new Date()
//         };

//         // Only add appointmentuserId if it's valid
//         if (appointmentuserId && mongoose.Types.ObjectId.isValid(appointmentuserId)) {
//             appointmentDetailField.appointmentuserId = appointmentuserId;
//         }

//         const savedAppointmentDetail = await saveModel(appointmentdetailModel, appointmentDetailField);

//         const hospital = await hospitalModel.findById(hospitalId);
//         const hospitalAddress = hospital.address + ", " + hospital.city + ", " + hospital.state + ", " + hospital.pincode;

//         const bookingTimeForWhatsApp = formatBookingTime(savedAppointmentDetail.appointmentDate, savedAppointmentDetail.appointmentTime);
//         const whatsappMessageData = {
//             patientName: fullName,
//             doctorName: doctor.name,
//             hospitalAddress: hospitalAddress,
//             bookingTime: bookingTimeForWhatsApp
//         }
//         await sendWhatsAppMessages("newAppointment", [mobilenumber], whatsappMessageData);

//         return successResponse(res, 'Appointment created successfully', [
//             {
//                 appointmentId: savedAppointment._id,
//                 appointmentDetailId: appointmentDetailField._id,
//                 startTime: appointmentDetailField.startTime,
//                 endTime: appointmentDetailField.endTime,
//                 slot: appointmentDetailField.appointmentTime
//             }
//         ]);
//     } catch (error) {
//         console.error('Error in addAppointmentV2:', error);
//         return errorResponse(res, 'Error adding appointment');
//     }
// };

const addAppointmentV2 = async (req, res) => {
    let {
        userId,
        mobilenumber,
        fullName = "",
        doctorId = "",
        hospitalId,
        appointmentuserId = "",
        disease = "",
        chiefComplaints = "",
        probableDiagnosis = "",
        appointmentDate = "",
        appointmentTime = "",
        startTime = "",
        endTime = "",
        isEmergency = false
    } = req.body;

    try {
        // Validation
        if (!fullName) return errorResponse(res, 'Full name is required');
        if (!mobilenumber) return errorResponse(res, 'Mobile number is required');
        if (!appointmentDate || !appointmentTime || !doctorId) {
            return errorResponse(res, 'Doctor, appointment date, and time are required');
        }

        // Get duration from settings
        let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");
        let durationValue = parseInt(durationData?.data?.[0]?.value || "0");
        let doctor = await doctorModel.findById(doctorId);
        durationValue = parseInt(doctor?.averageAppointmentTime || "0");

        // Get day of week (0 = Sunday, 1 = Monday, etc.)
        const dayOfWeek = moment(appointmentDate).day();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = days[dayOfWeek];

        // Get working hours for this day
        const dayWorkingHours = doctor.workingHours?.[dayName];

        // Check if doctor is available on this day
        if (!dayWorkingHours || !dayWorkingHours.isAvailable) {
            return errorResponse(res, 'Doctor is not available on this day');
        }

        // Check if appointment time is within working hours
        const isWithinWorkingHoursResult = isWithinWorkingHours(appointmentDate, startTime, endTime, dayWorkingHours)
        if (!isWithinWorkingHoursResult) {
            return errorResponse(res, 'Appointment time is not within doctor\'s working hours');
        }

        const startRange = moment(`${appointmentDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const endRange = moment(`${appointmentDate} ${endTime}`, "YYYY-MM-DD HH:mm");

        // doctor slot size
        const slotSize = parseInt(doctor.averageAppointmentTime || "30");

        // 1. Get all booked appointments for this doctor & date
        const bookedAppointments = await appointmentdetailModel.aggregate([
            {
                $lookup: {
                    from: "appointments",
                    localField: "appointmentId",
                    foreignField: "_id",
                    as: "appointment"
                }
            },
            { $unwind: "$appointment" },
            {
                $match: {
                    "appointment.doctorId": new mongoose.Types.ObjectId(doctorId),
                    appointmentDate: new Date(appointmentDate),
                    delete: false
                }
            }
        ]);

        // Convert booked slots into start–end ranges
        const bookedRanges = bookedAppointments.map(appt => {
            const existingStart = moment(`${appointmentDate} ${appt.appointmentTime}`, "YYYY-MM-DD HH:mm");
            const existingEnd = existingStart.clone().add(slotSize, "minutes");  // ✅ clone before add
            return { start: existingStart, end: existingEnd };
        });

        // 2. Iterate through requested range in steps of slotSize
        let chosenSlot = null;
        let current = startRange.clone();
        let totalBookedMinutes = 0;

        while (current.add(0, "minutes").isBefore(endRange)) {
            const potentialStart = current.clone();
            let potentialEnd = current.clone().add(slotSize, "minutes");

            // make sure slot fits inside requested range
            if ((60 - totalBookedMinutes) < 3 && potentialEnd.isAfter(endRange)) break;
            //if potentialEnd > endRange then set potentialEnd to endRnage
            if (potentialEnd.isAfter(endRange)) potentialEnd = endRange;

            // check overlap with any booked slot
            const overlap = bookedRanges.some(
                b => potentialStart.isBefore(b.end) && potentialEnd.isAfter(b.start)
            );

            if (!overlap) {
                chosenSlot = { start: potentialStart, end: potentialEnd };
                break;
            }

            // move to next slot
            current = current.add(slotSize, "minutes");
            totalBookedMinutes += slotSize;
        }

        // 3. Decide
        if (!chosenSlot) {
            return errorResponse(res, "No available slot in requested range.");
        }

        let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
        if (!checkMobileNumber) {
            const user = await saveModel(userModel, {
                fullName,
                mobileNumber: mobilenumber,
            });
            userId = user._id;
        } else {
            userId = checkMobileNumber._id;
        }

        // Create appointment
        const appointmentField = {
            userId,
            mobileNumber: mobilenumber,
            fullName,
            hospitalId,
            doctorId,
            create: new Date()
        };
        const savedAppointment = await saveModel(appointmentModel, appointmentField);

        if (!savedAppointment) {
            return errorResponse(res, 'Error creating appointment');
        }

        // Parse startTime and add duration in minutes

        // Build appointment detail data
        let appointmentDetailField = {
            userId,
            disease,
            doctorId,
            duration: `${durationValue}`,
            appointmentDate,
            appointmentTime: chosenSlot.start.format("HH:mm"),
            startTime: chosenSlot.start.format("HH:mm"),
            endTime: endTime,
            chiefComplaints,
            probableDiagnosis,
            isEmergency,
            appointmentId: savedAppointment._id,
            create: new Date()
        };

        appointmentDetailField.endTime = moment(appointmentDetailField.appointmentTime, 'HH:mm').add(durationValue, 'minutes').format('HH:mm');

        // Only add appointmentuserId if it's valid
        if (appointmentuserId && mongoose.Types.ObjectId.isValid(appointmentuserId)) {
            appointmentDetailField.appointmentuserId = appointmentuserId;
        }

        const savedAppointmentDetail = await saveModel(appointmentdetailModel, appointmentDetailField);

        const hospital = await hospitalModel.findById(hospitalId);
        const hospitalAddress = hospital.address + ", " + hospital.city + ", " + hospital.state + ", " + hospital.pincode;

        const bookingTimeForWhatsApp = formatBookingTime(savedAppointmentDetail.appointmentDate, savedAppointmentDetail.appointmentTime);
        const whatsappMessageData = {
            patientName: fullName,
            doctorName: doctor.name,
            hospitalAddress: hospitalAddress,
            bookingTime: bookingTimeForWhatsApp
        }
        await sendWhatsAppMessages("newAppointment", [mobilenumber], whatsappMessageData);

        return successResponse(res, 'Appointment created successfully', [
            {
                appointmentId: savedAppointment._id,
                appointmentDetailId: appointmentDetailField._id,
                startTime: appointmentDetailField.startTime,
                endTime: appointmentDetailField.endTime,
                slot: appointmentDetailField.appointmentTime
            }
        ]);
    } catch (error) {
        console.error('Error in addAppointmentV2:', error);
        return errorResponse(res, 'Error adding appointment');
    }
};

const deleteAppointment = async (req, res) => {
    const { appointmentId } = req.body;
    try {
        if (!appointmentId) {
            return errorResponse(res, 'Appointment ID is required');
        }

        // Find the appointment and delete it
        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 'Appointment not found');
        }

        // Soft delete the appointment
        appointment.delete = true;
        await appointment.save();

        // delete appointment details where appointmentId is appointmentId
        await appointmentdetailModel.updateMany(
            { appointmentId },
            { $set: { delete: true } }
        );

        // Soft delete appointment details
        const details = await appointmentdetailModel.findOne({ appointmentId });
        if (details) {
            details.delete = true;
            await details.save();

            const appointmentDetails = await getAppointmentDetails(appointmentId);

            const bookingTimeForWhatsApp = formatBookingTime(appointmentDetails.appointmentDate, appointmentDetails.appointmentTime);
            const whatsappMessageData = {
                patientName: appointmentDetails.patient.fullName,
                doctorName: appointmentDetails.doctor.name,
                hospitalAddress: appointmentDetails.hospital.address + ", " + appointmentDetails.hospital.city + ", " + appointmentDetails.hospital.state + ", " + appointmentDetails.hospital.pincode,
                bookingTime: bookingTimeForWhatsApp
            }
            await sendWhatsAppMessages("deleteAppointment", [appointmentDetails.patient.mobileNumber], whatsappMessageData);

            // ⚡ Shift remaining appointments for that doctor/date
            await shiftAppointments(details.doctorId, details.appointmentDate, details.startTime, details.endTime, parseInt(details.duration) || 30);
        }

        return successResponse(res, 'Appointment deleted successfully', []);
    } catch (error) {
        console.error('Error deleting appointment:', error);
        return errorResponse(res, 'Error deleting appointment');
    }
}

const getSlotsDetails = async (req, res) => {
    try {
        const { doctorId, date } = req.body;
        if (!doctorId || !date) {
            return errorResponse(res, 'Doctor ID and date are required');
        }

        const doctorDetails = await doctorModel.findById(doctorId);

        let averageDuration = doctorDetails.averageAppointmentTime;

        // Convert input date to YYYY-MM-DD format for exact date comparison
        const dateStr = moment(date).format('YYYY-MM-DD');

        const appointments = await appointmentdetail.find({
            doctorId,
            $expr: {
                $eq: [
                    { $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' } },
                    dateStr
                ]
            },
            delete: false
        });

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = new Date(date).getDay();
        const dayName = days[dayOfWeek];
        const dayWorkingHours = doctorDetails.workingHours?.[dayName];

        if (!dayWorkingHours || !dayWorkingHours.isAvailable) {
            return []; // Return empty slots if doctor is not available on this day
        }

        const workStart = moment(`${date} ${dayWorkingHours.start}`, "YYYY-MM-DD HH:mm");
        const workEnd = moment(`${date} ${dayWorkingHours.end}`, "YYYY-MM-DD HH:mm");

        let hourSlots = [];
        let current = workStart.clone();

        // Convert break times to moment objects for comparison
        const breaks = (dayWorkingHours.breaks || []).map(breakTime => ({
            start: moment(`${date} ${breakTime.start}`, "YYYY-MM-DD HH:mm"),
            end: moment(`${date} ${breakTime.end}`, "YYYY-MM-DD HH:mm")
        })).sort((a, b) => a.start.diff(b.start));

        while (current.isBefore(workEnd)) {
            const slotStart = current.clone();
            const slotEnd = moment.min(
                current.clone().add(1, "hour"),
                workEnd
            );

            // Find any breaks that overlap with this hour
            const overlappingBreaks = breaks.filter(breakTime =>
                !(breakTime.end.isSameOrBefore(slotStart) || breakTime.start.isSameOrAfter(slotEnd))
            );

            if (overlappingBreaks.length === 0) {
                // No breaks in this hour, add full hour slot
                hourSlots.push({
                    start: slotStart.format("HH:mm"),
                    end: slotEnd.format("HH:mm"),
                    isAvailable: true
                });
            } else {
                // Handle breaks within the hour
                let lastEnd = slotStart;

                for (const breakTime of overlappingBreaks) {
                    // Add slot before break
                    if (breakTime.start > lastEnd) {
                        hourSlots.push({
                            start: lastEnd.format("HH:mm"),
                            end: breakTime.start.format("HH:mm"),
                            isAvailable: true
                        });
                    }
                    lastEnd = moment.max(breakTime.end, lastEnd);

                    // If we've reached the end of the hour, break out
                    if (lastEnd >= slotEnd) break;
                }

                // Add remaining time after last break
                if (lastEnd < slotEnd) {
                    hourSlots.push({
                        start: lastEnd.format("HH:mm"),
                        end: slotEnd.format("HH:mm"),
                        isAvailable: true
                    });
                }
            }

            current = slotEnd;
        }

        // Check booked appointments against each hour slot
        // appointments.forEach(appt => {
        //     const apptStart = moment(appt.appointmentTime, "HH:mm"); // e.g., "11:20"
        //     const apptEnd = apptStart.clone().add(averageDuration, "minutes");

        //     hourSlots.forEach(slot => {
        //         const slotStart = moment(slot.start, "HH:mm");
        //         const slotEnd = moment(slot.end, "HH:mm");

        //         // If appointment fits in slot => mark slot unavailable
        //         if (
        //             (apptStart.isSameOrAfter(slotStart) && apptStart.isBefore(slotEnd)) ||
        //             (apptEnd.isAfter(slotStart) && apptEnd.isSameOrBefore(slotEnd))
        //         ) {
        //             slot.isAvailable = false;
        //         }
        //     });
        // });

        // // Filter only available slots
        // const availableSlots = hourSlots
        //     .filter(slot => slot.isAvailable)
        //     .map(slot => ({
        //         startTime: slot.start,
        //         endTime: slot.end,
        //         timeRange: `${slot.start}-${slot.end}`
        //     }));


        // Check booked appointments against each hour slot
        appointments.forEach(appt => {
            const apptStart = moment(appt.appointmentTime, "HH:mm");
            const apptEnd = moment(apptStart).add(
                parseInt(appt.duration || averageDuration),
                "minutes"
            );

            hourSlots.forEach(slot => {
                const slotStart = moment(slot.start, "HH:mm");
                const slotEnd = moment(slot.end, "HH:mm");

                // Overlap check (UNCHANGED)
                if (
                    (apptStart.isSameOrAfter(slotStart) && apptStart.isBefore(slotEnd)) ||
                    (apptEnd.isAfter(slotStart) && apptEnd.isSameOrBefore(slotEnd)) ||
                    (apptStart.isSameOrBefore(slotStart) && apptEnd.isSameOrAfter(slotEnd))
                ) {
                    if (!slot.unavailableRanges) slot.unavailableRanges = [];

                    slot.unavailableRanges.push({
                        start: apptStart.format("HH:mm"),
                        end: apptEnd.format("HH:mm")
                    });
                }
            });
        });


        // ================== SLOT AVAILABILITY CHECK ==================

        const availableSlots = hourSlots.filter(slot => {
            const slotStart = moment(slot.start, "HH:mm");
            const slotEnd = moment(slot.end, "HH:mm");

            // If no bookings → slot fully available
            if (!slot.unavailableRanges || slot.unavailableRanges.length === 0) {
                return slotEnd.diff(slotStart, "minutes") >= 5;
            }

            // Sort booked ranges
            const sortedRanges = [...slot.unavailableRanges].sort((a, b) =>
                moment(a.start, "HH:mm").diff(moment(b.start, "HH:mm"))
            );

            let currentStart = slotStart.clone();

            for (const range of sortedRanges) {
                const rangeStart = moment(range.start, "HH:mm");

                // Check gap before booking
                const freeMinutes = rangeStart.diff(currentStart, "minutes");
                if (freeMinutes >= 5) {
                    return true; // SLOT IS AVAILABLE → RETURN FULL SLOT
                }

                currentStart = moment.max(
                    currentStart,
                    moment(range.end, "HH:mm")
                );
            }

            // Check gap after last booking
            return slotEnd.diff(currentStart, "minutes") >= 5;
        })
            .map(slot => ({
                startTime: slot.start,
                endTime: slot.end,
                timeRange: `${slot.start}-${slot.end}`
            }));


        // ================== RESPONSE ==================

        return successResponse(res, "Available slots fetched successfully", {
            doctorId,
            date,
            averageDuration,
            availableSlots
        });

    } catch (error) {
        console.error('Error fetching slots:', error);
        return errorResponse(res, 'Error fetching slots: ' + error.message);
    }
}

// get appointments with details
// const getAppointmentsWithDetailsOld = async (req, res) => {
//     try {
//         const { appointmentId } = req.query;

//         // Get start of today (00:00:00)
//         const startOfToday = moment().startOf('day').toDate();
//         let appointmentFilter = {
//             delete: false,
//             appointmentDate: {
//                 $gte: startOfToday
//             }
//         };
//         if (appointmentId) {
//             appointmentFilter._id = appointmentId;
//         }

//         // 1. Fetch appointmentDetails with populated appointment
//         const { data: appointmentDetails } = await selectdatawithjoin({
//             Model: appointmentdetailModel,
//             condition: appointmentFilter,
//             limit: 100,
//             offset: 0,
//             joinModel: [
//                 {
//                     path: 'appointmentId',
//                     select: 'amount payableAmount create userId doctorId hospitalId mobileNumber fullName',
//                     populate: [
//                         { path: 'userId', select: 'fullName email mobileNumber gender' },
//                         { path: 'doctorId', select: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience' },
//                         { path: 'hospitalId', select: 'name email mobileNumber address' }
//                     ]
//                 }
//             ],
//             fields: "duration appointmentTime appointmentDate inTime outTime disease isEmergency delete",
//             sortBy: { '_id': -1 },
//         });

//         if (appointmentDetails.length === 0) {
//             // return res.status(404).json({
//             //     success: false,
//             //     message: 'No appointment details found',
//             // });
//             return res.status(200).json({
//                 success: true,
//                 message: 'Appointments fetched successfully',
//                 data: []
//             });
//         }

//         // 2. Group by appointmentId
//         const groupedAppointments = {};

//         appointmentDetails.forEach(detail => {
//             const appointment = detail.appointmentId?._id?.toString();
//             if (!appointment) return; // skip if no appointment linked

//             if (!groupedAppointments[appointment]) {
//                 groupedAppointments[appointment] = {
//                     ...detail.appointmentId?.toObject?.() || {},
//                     appointmentDetails: []
//                 };
//             }

//             // push the appointment detail
//             groupedAppointments[appointment].appointmentDetails.push({
//                 ...detail.toObject(),
//                 appointmentId: undefined // optional: remove extra data from detail
//             });
//         });

//         const result = Object.values(groupedAppointments);

//         // 3. Send success response
//         return res.status(200).json({
//             success: true,
//             message: 'Appointments fetched successfully',
//             data: result
//         });

//     } catch (error) {
//         console.error('Error fetching appointments:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Something went wrong while fetching appointments'
//         });
//     }
// };

// const getAppointmentsWithDetails = async (req, res) => {
//     try {
//         const { appointmentId, dateFilter } = req.body;

//         // Get start of today (00:00:00) as string
//         const startOfToday = moment().format('YYYY-MM-DD');
//         let appointmentFilter = {
//             delete: false,
//             // appointmentDate: { $gte: startOfToday } // string comparison works for YYYY-MM-DD
//         };
//         if (appointmentId) {
//             appointmentFilter._id = appointmentId;
//         }

//         if (dateFilter === 'today') {
//             const start = moment().startOf('day').toDate();
//             const end = moment().endOf('day').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         } else if (dateFilter === 'week') {
//             const start = moment().startOf('week').toDate();
//             const end = moment().endOf('week').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         } else if (dateFilter === 'month') {
//             const start = moment().startOf('month').toDate();
//             const end = moment().endOf('month').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         } else if (dateFilter === 'lastMonth') {
//             const start = moment().subtract(1, 'month').startOf('month').toDate();
//             const end = moment().subtract(1, 'month').endOf('month').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         }


//         const { data: appointmentDetails } = await selectdatawithjoin({
//             Model: appointmentdetailModel,
//             condition: appointmentFilter,
//             limit: 100,
//             offset: 0,
//             joinModel: [
//                 {
//                     path: 'appointmentId',
//                     select: 'amount payableAmount create userId doctorId hospitalId mobileNumber fullName',
//                     populate: [
//                         { path: 'userId', select: 'fullName email mobileNumber gender' },
//                         { path: 'doctorId', select: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience' },
//                         { path: 'hospitalId', select: 'name email mobileNumber address' }
//                     ]
//                 }
//             ],
//             fields: "duration appointmentTime appointmentDate inTime outTime disease isEmergency chiefComplaints probableDiagnosis prescriptionList labInvestigations labReports doctorRemarks nextAppointmentDate status delete",
//             sortBy: { '_id': -1 },
//         });

//         if (appointmentDetails.length === 0) {
//             return res.status(200).json({
//                 success: true,
//                 message: 'Appointments fetched successfully',
//                 data: []
//             });
//         }


//         // Group by appointmentId
//         const groupedAppointments = {};
//         appointmentDetails.forEach(detail => {
//             const appointment = detail.appointmentId?._id?.toString();
//             if (!appointment) return;
//             if (!groupedAppointments[appointment]) {
//                 groupedAppointments[appointment] = {
//                     ...((detail.appointmentId && typeof detail.appointmentId.toObject === 'function') ? detail.appointmentId.toObject() : detail.appointmentId) || {},
//                     appointmentDetails: []
//                 };
//             }
//             groupedAppointments[appointment].appointmentDetails.push({
//                 ...detail.toObject(),
//                 appointmentId: undefined
//             });
//         });

//         const result = Object.values(groupedAppointments);

//         return res.status(200).json({
//             success: true,
//             message: 'Appointments fetched successfully',
//             data: result
//         });

//     } catch (error) {
//         console.error('Error fetching appointments:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Something went wrong while fetching appointments'
//         });
//     }
// };

// const getAppointmentsWithDetails = async (req, res) => {
//     try {
//         const { appointmentId, dateFilter, status, hospitalId } = req.body;

//         let appointmentFilter = { delete: false };

//         if (status && ['Ongoing', 'Completed'].includes(status)) {
//             appointmentFilter.status = status;
//         }

//         if (appointmentId) {
//             appointmentFilter._id = appointmentId;
//         }
//         // if (hospitalId) {
//         //     console.log("hospitalId", hospitalId);
//         //     appointmentFilter.hospitalId = hospitalId;
//         // }
//         // if (hospitalId) {
//         //     appointmentFilter['appointmentId.hospitalId'] = hospitalId;
//         // }

//         if (dateFilter === 'today') {
//             const start = moment().startOf('day').toDate();
//             const end = moment().endOf('day').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         } else if (dateFilter === 'week') {
//             const start = moment().startOf('week').toDate();
//             const end = moment().endOf('week').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         } else if (dateFilter === 'month') {
//             const start = moment().startOf('month').toDate();
//             const end = moment().endOf('month').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         } else if (dateFilter === 'lastMonth') {
//             const start = moment().subtract(1, 'month').startOf('month').toDate();
//             const end = moment().subtract(1, 'month').endOf('month').toDate();
//             appointmentFilter.appointmentDate = { $gte: start, $lte: end };
//         }

//         const { data: appointmentDetails } = await selectdatawithjoin({
//             Model: appointmentdetailModel,
//             condition: appointmentFilter,
//             limit: 100,
//             offset: 0,
//             joinModel: [
//                 {
//                     path: 'appointmentId',
//                     select: 'amount payableAmount create userId doctorId hospitalId mobileNumber fullName',
//                     populate: [
//                         { path: 'userId', select: 'fullName email mobileNumber gender' },
//                         { path: 'doctorId', select: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience' },
//                         { path: 'hospitalId', select: 'name email mobileNumber address' }
//                     ]
//                 }
//             ],
//             fields: "duration appointmentTime appointmentDate inTime outTime disease isEmergency chiefComplaints probableDiagnosis prescriptionList labInvestigations labReports doctorRemarks nextAppointmentDate status delete",
//             sortBy: { '_id': -1 },
//         });

//         if (appointmentDetails.length === 0) {
//             return res.status(200).json({
//                 success: true,
//                 message: 'Appointments fetched successfully',
//                 data: []
//             });
//         }

//         // Add missing fields manually
//         const ensureDefaultFields = (detail) => ({
//             _id: detail._id,
//             duration: detail.duration ?? "",
//             appointmentTime: detail.appointmentTime ?? "",
//             appointmentDate: detail.appointmentDate ?? "",
//             inTime: detail.inTime ?? "",
//             outTime: detail.outTime ?? "",
//             disease: detail.disease ?? "",
//             isEmergency: detail.isEmergency ?? false,
//             chiefComplaints: detail.chiefComplaints ?? "",
//             probableDiagnosis: detail.probableDiagnosis ?? "",
//             prescriptionList: detail.prescriptionList ?? "",
//             labInvestigations: detail.labInvestigations ?? "",
//             labReports: detail.labReports ?? "",
//             doctorRemarks: detail.doctorRemarks ?? "",
//             nextAppointmentDate: detail.nextAppointmentDate ?? "",
//             status: detail.status ?? "Ongoing",
//             delete: detail.delete ?? false
//         });

//         // Group by appointmentId
//         const groupedAppointments = {};
//         appointmentDetails.forEach(detail => {
//             const appointment = detail.appointmentId?._id?.toString();
//             if (!appointment) return; // skip if no appointment linked

//             if (!groupedAppointments[appointment]) {
//                 groupedAppointments[appointment] = {
//                     ...((detail.appointmentId && typeof detail.appointmentId.toObject === 'function')
//                         ? detail.appointmentId.toObject()
//                         : detail.appointmentId),
//                     appointmentDetails: []
//                 };
//             }

//             // push the appointment detail
//             groupedAppointments[appointment].appointmentDetails.push({
//                 ...ensureDefaultFields(detail),
//                 appointmentId: undefined // to avoid redundancy
//             });
//         });

//         const result = Object.values(groupedAppointments);

//         return res.status(200).json({
//             success: true,
//             message: 'Appointments fetched successfully',
//             data: result
//         });

//     } catch (error) {
//         console.error('Error fetching appointments:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Something went wrong while fetching appointments'
//         });
//     }
// };

const getAppointmentsWithDetails = async (req, res) => {
    try {
        const { appointmentId, dateFilter, status, hospitalId } = req.body;

        const matchConditions = { delete: false };

        if (appointmentId) {
            matchConditions._id = mongoose.Types.ObjectId(appointmentId);
        }

        if (status && ["Ongoing", "Completed"].includes(status)) {
            matchConditions.status = status;
        }

        // Date filter
        let start, end;
        if (dateFilter === 'today') {
            start = moment().startOf('day').toDate();
            end = moment().endOf('day').toDate();
        } else if (dateFilter === 'week') {
            start = moment().startOf('week').toDate();
            end = moment().endOf('week').toDate();
        } else if (dateFilter === 'month') {
            start = moment().startOf('month').toDate();
            end = moment().endOf('month').toDate();
        } else if (dateFilter === 'lastMonth') {
            start = moment().subtract(1, 'month').startOf('month').toDate();
            end = moment().subtract(1, 'month').endOf('month').toDate();
        }

        if (start && end) {
            matchConditions.appointmentDate = { $gte: start, $lte: end };
        }

        const pipeline = [
            { $match: matchConditions },
            {
                $lookup: {
                    from: 'appointments',
                    localField: 'appointmentId',
                    foreignField: '_id',
                    as: 'appointmentData'
                }
            },
            { $unwind: "$appointmentData" },
            {
                $match: hospitalId ? { 'appointmentData.hospitalId': new mongoose.Types.ObjectId(hospitalId) } : {}
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'appointmentData.userId',
                    foreignField: '_id',
                    as: 'appointmentData.user'
                }
            },
            {
                $lookup: {
                    from: 'doctors',
                    localField: 'appointmentData.doctorId',
                    foreignField: '_id',
                    as: 'appointmentData.doctor',
                    pipeline: [
                        {
                            $lookup: {
                                from: 'specializations',
                                localField: 'specializationId',
                                foreignField: '_id',
                                as: 'specialization'
                            }
                        },
                        {
                            $unwind: {
                                path: '$specialization',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $project: {
                                name: 1,
                                email: 1,
                                mobileNumber: 1,
                                specialization: '$specialization.name',
                                experience: 1,
                                profile: 1,
                                appointmentCharge: 1,
                                averageAppointmentTime: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'hospitals',
                    localField: 'appointmentData.hospitalId',
                    foreignField: '_id',
                    as: 'appointmentData.hospital'
                }
            },
            {
                $project: {
                    duration: 1,
                    appointmentTime: 1,
                    appointmentDate: 1,
                    inTime: 1,
                    outTime: 1,
                    disease: 1,
                    isEmergency: 1,
                    chiefComplaints: 1,
                    probableDiagnosis: 1,
                    prescriptionList: 1,
                    labInvestigations: 1,
                    labReports: 1,
                    doctorRemarks: 1,
                    nextAppointmentDate: 1,
                    status: 1,
                    delete: 1,
                    appointmentData: 1
                }
            },
            { $sort: { _id: -1 } }
        ];

        const appointmentDetails = await appointmentdetailModel.aggregate(pipeline);

        if (!appointmentDetails.length) {
            return res.status(200).json({
                success: true,
                message: 'Appointments fetched successfully',
                data: []
            });
        }

        const grouped = {};

        appointmentDetails.forEach(detail => {
            const appId = detail.appointmentData?._id?.toString();
            if (!appId) return;

            if (!grouped[appId]) {
                grouped[appId] = {
                    ...detail.appointmentData,
                    appointmentDetails: []
                };
            }

            delete detail.appointmentData; // remove redundancy
            grouped[appId].appointmentDetails.push(detail);
        });

        const result = Object.values(grouped);

        return res.status(200).json({
            success: true,
            message: 'Appointments fetched successfully',
            data: result
        });
    } catch (error) {
        console.error("Error in getAppointmentsWithDetails:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong while fetching appointments"
        });
    }
};

const getAppointmentsData = async (req, res) => {
    try {
        const { appointmentId, limit = 10, offset = 0 } = req.query;

        const appointmentFilter = { delete: false };
        if (appointmentId) {
            appointmentFilter._id = appointmentId;
        }

        // 1. Fetch appointments (paginated)
        const { data: appointments, totalRecords } = await selectdatawithjoin({
            Model: appointmentModel,
            condition: appointmentFilter,
            fields: 'amount payableAmount create userId doctorId hospitalId mobileNumber fullName',
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: { _id: -1 }
        });

        // if (appointments.length === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'No appointments found',
        //     });
        // }

        // 2. Get all appointment IDs
        const appointmentIds = appointments.map(app => app._id);

        // 3. Fetch related details
        const { data: allDetails } = await selectdatawithjoin({
            Model: appointmentdetailModel,
            condition: {
                delete: false,
                appointmentId: { $in: appointmentIds }
            },
            fields: 'appointmentId duration appointmentTime appointmentDate inTime outTime disease isEmergency userId doctorId hospitalId',
            joinModel: [
                { path: 'userId', select: 'fullName email mobileNumber gender' },
                { path: 'doctorId', select: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience' },
                { path: 'hospitalId', select: 'name email mobileNumber address' }
            ],
            sortBy: { _id: -1 }
        });

        // 4. Group details by appointmentId
        const detailMap = {};
        allDetails.forEach(detail => {
            const appId = detail.appointmentId?.toString();
            if (!detailMap[appId]) detailMap[appId] = [];
            detailMap[appId].push(detail);
        });

        // 5. Merge appointment with its details
        const mergedAppointments = appointments.map(app => ({
            ...app.toObject(),
            appointmentDetails: detailMap[app._id.toString()] || []
        }));

        return res.status(200).json({
            success: true,
            message: 'Appointments fetched successfully',
            totalRecords,
            data: mergedAppointments
        });

    } catch (error) {
        console.error('Error fetching appointments:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while fetching appointments'
        });
    }
};

// add edit setting 
const addeditSetting = async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key || value === undefined) {
            return errorResponse(res, 'Key and value are required');
        }

        // Check if setting with given key already exists
        let setting = await settingModel.findOne({ key });

        if (setting) {
            // If exists, update it
            setting.value = value;
            await setting.save();
            return successResponse(res, 'Setting updated successfully', setting);
        } else {
            // If not exists, create new
            const newSetting = await settingModel.create({ key, value });
            return successResponse(res, 'Setting created successfully', newSetting);
        }

    } catch (error) {
        console.error('Error in addOrUpdateSetting:', error);
        return errorResponse(res, 'Error adding or updating setting');
    }
};

// get setting
const getSettings = async (req, res) => {
    try {
        const { key } = req.query;

        const condition = {};
        if (key) {
            condition.key = key;
        }

        // Using selectdatawithjoin function
        const { data: settings } = await selectdatawithjoin({
            Model: settingModel,
            condition,
            fields: 'key value', // Only select key and value
            sortBy: { create: -1 } // Latest settings first (optional)
        });

        return successResponse(res, 'Settings fetched successfully', settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        return errorResponse(res, 'Error fetching settings');
    }
};

// update appointment time by type
const updateAppointmentTimeByType = async (req, res) => {
    try {
        const { appointmentId, type, time } = req.body;

        if (!appointmentId || !type) {
            return res.status(400).json({
                success: false,
                message: 'appointmentId and type ("in" or "out") are required'
            });
        }

        if (type !== 'in' && type !== 'out') {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "in" or "out"'
            });
        }

        // Find the appointmentDetail
        const appointmentDetail = await appointmentdetailModel.findOne({
            _id: appointmentId,
            delete: false
        });

        if (!appointmentDetail) {
            return res.status(404).json({
                success: false,
                message: 'Appointment detail not found'
            });
        }

        // Prepare the time
        let finalTime = time;
        if (!finalTime) {
            finalTime = new Date().toLocaleTimeString('en-US', { hour12: false });
            // Example format: "14:45:00"
        }

        const updateFields = {
            update: new Date()
        };

        if (type === 'in') {
            updateFields.inTime = finalTime;
        } else if (type === 'out') {
            updateFields.outTime = finalTime;
            updateFields.status = "Completed";
        }

        // Update the record
        const updatedDetail = await appointmentdetailModel.findByIdAndUpdate(
            appointmentDetail._id,
            { $set: updateFields },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: `Appointment ${type === 'in' ? 'start' : 'end'} time updated successfully`,
            data: updatedDetail
        });

    } catch (error) {
        console.error('Error updating appointment time:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while updating appointment time'
        });
    }
};

const getUserList = async (req, res) => {
    try {
        const { userId, stateId, cityId, limit = 10, offset = 0 } = req.body;

        const condition = { delete: false }; // Only active users

        if (userId) {
            condition._id = userId;
        }
        if (stateId) {
            condition.stateId = stateId;
        }
        if (cityId) {
            condition.cityId = cityId;
        }

        const { data: users, totalRecords } = await selectdatawithjoin({
            Model: userModel,
            condition,
            fields: 'fullName email mobileNumber gender address profile stateId cityId zipCode registerAppVersion registerOS registerDevice',
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: { create: -1 }
        });

        return successResponse(res, 'Users fetched successfully', {
            totalRecords,
            users
        }, true);
    } catch (error) {
        console.error('Error fetching users:', error);
        return errorResponse(res, 'Error fetching users');
    }
};

// edit appointment Details
const editAppointmentDetails = async (req, res) => {
    try {
        const {
            appointmentId,
            appointmentDate,
            appointmentTime,
            inTime,
            outTime,
            disease,
            isEmergency
        } = req.body;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'appointmentId is required'
            });
        }

        // Find the appointmentDetail
        const appointmentDetail = await appointmentdetailModel.findOne({
            delete: false,
            appointmentId: appointmentId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Appointment detail not found');
        }

        // Update the record
        const updatedDetail = await appointmentdetailModel.findByIdAndUpdate(
            appointmentDetail._id,
            {
                $set: {
                    appointmentId,
                    appointmentDate,
                    appointmentTime,
                    inTime,
                    outTime,
                    disease,
                    isEmergency,
                    update: new Date()
                }
            },
            { new: true }
        );

        return successResponse(res, 'Appointment detail updated successfully', updatedDetail);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

// edit appointment Details
const editAppointmentDetailsV2 = async (req, res) => {
    try {
        const {
            appointmentId,
            // appointmentDate,
            // appointmentTime,
            // inTime,
            // outTime,
            // disease,
            // isEmergency,

            chiefComplaints,
            probableDiagnosis,
            prescriptionList,
            labInvestigations,
            labReports,
            doctorRemarks,
            nextAppointmentDate

        } = req.body;

        const labReportFile = req.file || null;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'appointmentId is required'
            });
        }

        // Find the appointmentDetail
        const appointmentDetail = await appointmentdetailModel.findOne({
            delete: false,
            appointmentId: appointmentId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Appointment detail not found');
        }
        // console.log("labReportFile", labReportFile);

        // Update the record
        const updatedDetail = await appointmentdetailModel.findByIdAndUpdate(
            appointmentDetail._id,
            {
                $set: {
                    appointmentId,
                    chiefComplaints,
                    probableDiagnosis,
                    prescriptionList,
                    labInvestigations,
                    labReports: labReportFile?.['path'],
                    doctorRemarks,
                    nextAppointmentDate,
                    update: new Date()
                }
            },
            { new: true }
        );

        return successResponse(res, 'Appointment detail updated successfully', updatedDetail);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

const checkoutDoctorUpdate = async (req, res) => {
    try {
        const { doctorId, type, reason } = req.body;

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'doctorId is required'
            });
        }

        // Find the doctor
        const appointmentDetail = await doctorModel.findOne({
            delete: false,
            _id: doctorId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Doctor detail not found');
        }



        // Update the record
        if (type == "START") {
            let obj = { doctorId: doctorId, startTime: moment(), reason }
            await saveModel(checkOutModel, obj);

        } else if (type == "END") {

            let data = await checkOutModel.find({ doctorId: doctorId })
                .sort({ createdAt: -1 })  // sort newest first
                .limit(1);
            if (data.length != 0) {

                const updatedDetail = await checkOutModel.findByIdAndUpdate(
                    data[0]['_id'],
                    {
                        $set: {
                            endTime: new Date()
                        }
                    },
                    { new: true }
                );
            } else {
                return errorResponse(res, 'Doctor not found checkout entry');
            }
        }


        return successResponse(res, 'successfully', []);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

const doctorUpdateAvailable = async (req, res) => {
    try {
        const { doctorId, isAvailable = true } = req.body;

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'doctorId is required'
            });
        }

        // Find the doctor
        const appointmentDetail = await doctorModel.findOne({
            delete: false,
            _id: doctorId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Doctor detail not found');
        }

        const updatedDetail = await doctorModel.findByIdAndUpdate(
            doctorId,
            {
                $set: {
                    isAvailable: isAvailable
                }
            },
            { new: true }
        );

        return successResponse(res, 'successfully', []);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

const hospitalView = async (req, res) => {

    try {
        const { hospitalId, limit, offset, text } = req.body;

        // Find the doctor
        const appointmentDetail = await hospitalModel.findOne({
            delete: false,
            _id: doctorId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Doctor detail not found');
        }

        const updatedDetail = await doctorModel.findByIdAndUpdate(
            doctorId,
            {
                $set: {
                    isAvailable: isAvailable
                }
            },
            { new: true }
        );

        return successResponse(res, 'successfully', []);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

// Save Banner
const addEditBanner = async (req, res) => {
    try {
        const { title = '', bannerId = '' } = req.body;

        let images = req.files['images'] || []

        let saveObj = { image: images[0]['filename'], title: title }
        if (bannerId) {
            await bannerModel.findByIdAndUpdate(
                bannerId,
                {
                    $set: saveObj
                },
                { new: true }
            );
        } else {
            await bannerModel.create(saveObj);
        }

        return successResponse(res, 'Banner Save successfully', {});

    } catch (err) {

        return errorResponse(res, 'Error creating');
    }
};

const bannerView = async (req, res) => {

    try {

        // Find the banner
        const bannerArr = await bannerModel.find({ delete: false });

        return successResponse(res, 'successfully', bannerArr);

    } catch (error) {

        return errorResponse(res, 'Erro detail');

    }
};

const getAllSpecializations = async (req, res) => {
    try {
        // Get all hospital specializations (array of specialization IDs)
        const hospitals = await hospitalModel.find({ delete: false }, { specialization: 1 });

        // Get all specialization IDs from hospitals
        const specializationIds = [
            ...new Set(
                hospitals.flatMap(hospital => hospital.specialization || [])
            )
        ];

        // Get specialization details
        const specializationModel = require('../../model/specialization');
        const specializations = await specializationModel.find({
            _id: { $in: specializationIds },
            delete: false
        }, { name: 1 });

        // Extract just the names
        const specializationNames = specializations.map(spec => spec.name);

        res.status(200).json({
            success: true,
            data: specializationNames
        });
    } catch (error) {
        console.error("Error fetching specializations:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = {
    test,
    addEditAdmin,
    login,
    adminProfile,
    addAppointment,
    addAppointmentV2,
    getSlotsDetails,
    addHospital,
    getHospitals,
    addDoctor,
    getDoctors,
    getAppointmentsWithDetails,
    addeditSetting,
    getSettings,
    updateAppointmentTimeByType,
    getUserList,
    deleteAppointment,
    getAppointmentsData,
    editAppointmentDetails,
    checkoutDoctorUpdate,
    doctorUpdateAvailable,
    imageUpload,
    addEditBanner,
    bannerView,
    hospitalLogin,
    hospitalView,
    editAppointmentDetailsV2,
    getSlotsDetails,
    getAllSpecializations
}
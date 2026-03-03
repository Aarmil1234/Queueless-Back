const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const userModel = require('../../model/user');
const { sendOTP, verifyOtpDB } = require('../../helper/otpService');
const { successResponse, errorResponse, saveModel, selectdata, selectdatv2, updateModel } = require('../../helper/index');
const doctorModel = require('../../model/doctor');
const hospitalModel = require('../../model/hospital');
const user = require('../../model/user');

// POST route to create or edit an user
const addEditUser = async (req, res) => {
    let userId = req.body.userId || "";
    let fullName = req.body.fullName || "";
    let mobileNumber = req.body.mobileNumber || "";
    let gender = req.body.gender || "";
    let email = req.body.email || "";
    let address = req.body.address || "";
    let stateId = req.body.stateId || "";
    let cityId = req.body.cityId || "";
    let zipCode = req.body.zipCode || "";
    let password = req.body.password || "";
    let profile = req.file ? `user/profiles/${req.file.filefullName}` : req.body.profile || "";
    let registerAppVersion = req.body.registerAppVersion || "";
    let registerOS = req.body.registerOS || "";
    let registerDevice = req.body.registerDevice || "";

    try {
        let field = {
            fullName, mobileNumber, address, email, gender, stateId, cityId, zipCode,
            registerAppVersion, registerOS, registerDevice
        };
        if (profile) {
            field.profile = profile;
        }

        if (userId) {
            // Edit existing user
            let user = await userModel.findById(userId);
            if (!user) {
                return errorResponse(res, 'Usder not found');
            }

            // Check if email or mobile number already exists for another user
            let existingUser = await userModel.findOne({
                $or: [{ email }, { mobileNumber }],
                _id: { $ne: userId }
            });
            if (existingUser) {
                return errorResponse(res, 'User with this email or mobile number already exists');
            }

            field.update = new Date();
            const updatedUser = await updateModel(userModel, { _id: userId }, field);
            return successResponse(res, 'User updated successfully', updatedUser);
        } else {
            // Check if email or mobile number already exists
            let existingUser = await userModel.findOne({ $or: [{ email }, { mobileNumber }] });
            if (existingUser) {
                return errorResponse(res, 'User with this email or mobile number already exists');
            }

            // Hash the password using MD5
            field.password = md5(password);
            const savedUser = await saveModel(userModel, field);
            return successResponse(res, 'User created successfully', savedUser);
        }
    } catch (error) {
        console.error('Error creating/updating user:', error);
        return errorResponse(res, 'Error creating/updating user');
    }
}

// login 
const login = async (req, res) => {
    let mobileNumber = req.body.mobileNumber || "";
    let password = req.body.password || "";

    try {
        const user = await userModel.findOne({
            $or: [{ mobileNumber: mobileNumber }],
            delete: false,
            // password: md5(password)
        });
        if (!user) {
            return errorResponse(res, 'Invalid credentials');
        }

        const response = await sendOTP(user.mobileNumber);
        console.log(response);
        if (response.success) {
            return successResponse(res, 'Login successful', user);
        }
        return errorResponse(res, 'Error logging in');
    } catch (error) {
        console.error('Error logging in:', error);
        return errorResponse(res, error);
    }
}

// user profile
const userProfile = async (req, res) => {
    const userId = req.body.userId || "";
    const limit = req.body.limit || 0;
    const offset = req.body.offset || 0;
    const searchQuery = req.body.searchQuery || "";

    try {
        const fields = `
            fullName 
            email 
            mobileNumber 
            dob 
            gender 
            address 
            stateId 
            cityId 
            zipCode 
            profile 
            loginOS 
            loginAppVersion 
            loginDevice 
            registerAppVersion 
            registerOS 
            registerDevice
            createdAt
            updatedAt
        `;
        let data = await selectdatv2(userModel, { _id: userId, delete: false }, fields, limit, offset, fields, searchQuery, { createdAt: -1 });
        if (data.length == 0) {
            return errorResponse(res, 'User not found');
        }
        return successResponse(res, 'User profile fetched successfully', data, true);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return errorResponse(res, 'Error fetching user profile');
    }
}

// verify otp
const verifyOtp = async (req, res) => {
    let mobileNumber = req.body.mobileNumber || "";
    let otp = req.body.otp || "";

    try {
        let response = await verifyOtpDB(mobileNumber, otp);
        const user = await userModel.findOne({ mobileNumber: mobileNumber });
        if (!req.body.isRegister) {
            if (!user) {
                return errorResponse(res, 'User not found');
            }
            response.userDetails = user;
        }

        if (response.status) {
            return successResponse(res, 'Login successful', response);
        }
    } catch (error) {
        console.error('Error logging in:', error);
        return errorResponse(res, 'Error logging in');
    }
}

const registrationOtp = async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        const userDetails = await user.findOne({ mobileNumber: mobileNumber });
        let response;
        if (!userDetails) {
            response = await sendOTP(mobileNumber);
        }
        console.log(response);
        if (response.success) {
            return successResponse(res, 'Otp for registration is sent successfully');
        }
    } catch (e) {
        return errorResponse(res, "Error while sending otp");
    }
}

const searchDoctorsAndHospitalsByName = async (req, res) => {
    try {
        const { name = "", limit = 10, offset = 0 } = req.body;

        if (!name.trim()) {
            return errorResponse(res, "Name is required for search.");
        }

        const nameRegex = new RegExp(name.trim(), 'i'); // Case-insensitive partial match

        // Search doctors by name
        const doctors = await doctorModel.find({
            delete: false,
            name: nameRegex
        })
            .select('name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience profile age gender')
            .populate({ path: 'specializationId', select: 'name' })
            .populate({ path: 'degreeId', select: 'name' })
            .populate({ path: 'hospitalId', select: 'name email mobileNumber address' })
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        // Search hospitals by name
        const hospitals = await hospitalModel.find({
            delete: false,
            name: nameRegex
        })
            .select('name email mobileNumber address city type specializationDescription profile')
            .skip(parseInt(offset))
            .limit(parseInt(limit));

        return successResponse(res, 'Search results fetched successfully', {
            doctors,
            hospitals
        });

    } catch (error) {
        console.error('Error in name search:', error);
        return errorResponse(res, 'Error fetching search results');
    }
};

const getDashboardImages = async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, "../uploads/dashboard");

        // Read all files from dashboard folder
        const files = fs.readdirSync(directoryPath);

        if (!files || files.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No images found in dashboard folder",
            });
        }

        // Filter only image files (optional but recommended)
        const imageFiles = files.filter((file) =>
            /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
        );

        // Return only first 3 images
        const dashboardImages = imageFiles.slice(0, 3).map((file) => ({
            name: file,
            url: `${req.protocol}://${req.get("host")}/uploads/dashboard/${file}`,
        }));

        return successResponse(res, 'Images Fetched successfully', dashboardImages)
    } catch (error) {
        console.error("Error fetching dashboard images:", error);
        return errorResponse(res, 'Error fetching search results');
    }
};

module.exports = {
    addEditUser,
    login,
    userProfile,
    verifyOtp,
    registrationOtp,
    searchDoctorsAndHospitalsByName,
    getDashboardImages
}
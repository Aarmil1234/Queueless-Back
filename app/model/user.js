// const mongoose = require('mongoose');

// const userSchema = new mongoose.Schema({
//     fullName: { type: String, required: false },
//     // in your user schema
//     email: { type: String, unique: true, sparse: true , default: null},
//     password: { type: String, required: false },
//     mobileNumber: { type: String, required: false },
//     dob: { type: Date, required: false },
//     gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], required: false, default: "MALE" },
//     address: { type: String, required: false },
//     stateId: { type: String, required: false },
//     cityId: { type: String, required: false },
//     // stateId: { type: mongoose.Schema.Types.ObjectId, ref: 'state', required: false },
//     // cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'city', required: false },
//     zipCode: { type: String, required: false },
//     profile: { type: String, required: false, default: "" },
//     loginOS: { type: String, required: false },
//     loginAppVersion: { type: String, required: false },
//     loginDevice: { type: String, required: false },
//     registerAppVersion: { type: String, required: false },
//     registerOS: { type: String, required: false },
//     registerDevice: { type: String, required: false },
//     create: { type: Date, default: Date.now },
//     update: { type: Date, default: Date.now },
//     delete: { type: Boolean, default: false },
// });

// const user = mongoose.model('user', userSchema);

// module.exports = user;


const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: false },
    email: { type: String, unique: true, sparse: true, default: null },
    password: { type: String, required: false },
    mobileNumber: { type: String, required: false },
    dob: { type: Date, required: false },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], required: false, default: "MALE" },
    address: { type: String, required: false },
    stateId: { type: String, required: false },
    cityId: { type: String, required: false },
    zipCode: { type: String, required: false },
    profile: { type: String, required: false, default: "" },
    loginOS: { type: String, required: false },
    loginAppVersion: { type: String, required: false },
    loginDevice: { type: String, required: false },
    registerAppVersion: { type: String, required: false },
    registerOS: { type: String, required: false },
    registerDevice: { type: String, required: false },
    create: { type: Date, default: Date.now },
    update: { type: Date, default: Date.now },
    delete: { type: Boolean, default: false },
});

const user = mongoose.model('user', userSchema);

module.exports = user;

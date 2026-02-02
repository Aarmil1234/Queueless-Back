const express = require('express');
const router = express.Router();
const ipdController = require("../controller/admin/ipdController");
const uploadFile = require("../../middleware/upload");

router.post('/moveToIpd', ipdController.moveToIpd);

// Get all IPD patients with pagination and filtering
router.get('/patients', ipdController.getAllIpdPatients);

router.get('/getAllIpd', ipdController.getAllIpd);

router.get('/getAllDischargedIpd', ipdController.getAllDischargedIpd);

// Get single IPD patient details
router.get('/patients/:ipdId', ipdController.getIpdPatientById);

// Update IPD patient information
router.put('/patients/:ipdId', ipdController.updateIpdPatient);

// Discharge IPD patient
router.post('/patients/:ipdId/discharge', ipdController.dischargeIpdPatient);

router.get('/getAllIpdInstructions/:ipdId', ipdController.getAllIpdInstructions);
router.post('/addInstructions', uploadFile, ipdController.addIpdInstructionByDoctor);
router.get('/getIpdDetails/:ipdId', ipdController.getIpdDetails);
router.post('/dischargePatient', ipdController.dischargePatient);
module.exports = router;
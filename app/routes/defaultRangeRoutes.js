const express = require('express');
const defaultParameterRangeController = require('../controller/laboratory/defaultParameterRangeController');
const router = express.Router();

router.get('/:id', defaultParameterRangeController.getAllParameterRangesByParameterId);
router.get('/:parameterId/:parameterRangeId', defaultParameterRangeController.getSingleParameterRange);
router.post('/add', defaultParameterRangeController.addDefaultParameterRange);
router.put('/:id', defaultParameterRangeController.updateDefaultParameterRange);
router.delete('/:id', defaultParameterRangeController.deleteParameterRange);

module.exports = router;
const validator = require('validator');
const {
    toTitleCase
} = require('./helpers');

/*
 * Validating what information exists and setting the existing data onto the object
 */
exports.reduceUserDetails = (data) => {
    let userDetails = {}

    if (!validator.isEmpty(data.about.trim())) userDetails.about = data.about
    if (!validator.isEmpty(data.location.trim())) userDetails.location = data.location
    if (!validator.isEmpty(data.firstName.trim())) userDetails.firstName = data.firstName
    if (!validator.isEmpty(data.lastName.trim())) userDetails.lastName = data.lastName
    if (!validator.isEmpty(data.gender.trim())) userDetails.gender = data.gender

    return userDetails
}

exports.validateSymptomData = (data) => {
    let symptomDetails = {}

    if (!validator.isEmpty(data.specialty)) symptomDetails.specialty = toTitleCase(data.specialty.trim())
    if (!validator.isEmpty(data.other)) symptomDetails.other = toTitleCase(data.other.trim())
    symptomDetails.createdAt = new Date().toISOString()
    symptomDetails.pendingDeletion = false
    symptomDetails.approved = false
    symptomDetails.critical = data.critical

    return symptomDetails
}

exports.validateVirusData = (data) => {
    let virusDetails = {}
    if (!validator.isEmpty(data.type)) virusDetails.type = toTitleCase(data.type.trim())
    if (!validator.isEmpty(data.duration)) virusDetails.duration = toTitleCase(data.duration.trim())
    if (!validator.isEmpty(data.specialty)) virusDetails.specialty = toTitleCase(data.specialty.trim())
    if (!validator.isEmpty(data.other)) virusDetails.other = toTitleCase(data.other.trim())
    virusDetails.createdAt = new Date().toISOString()
    virusDetails.pendingDeletion = false
    virusDetails.approved = false

    return virusDetails
}
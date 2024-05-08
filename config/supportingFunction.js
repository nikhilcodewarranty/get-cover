const mongoose = require('mongoose');
const userService = require('../User/services/userService')


async function getUserIds() {
    const getSuperId = await userService.findUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isDeleted: false, status: true }, {});
    console.log("getSuperId++++++++++++++++++++++", getSuperId)
    return getSuperId.map(ID => ID._id);
}

module.exports = getUserIds;
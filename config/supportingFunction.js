const mongoose = require('mongoose');
const userService = require('../User/services/userService')


exports.getUserIds= async()=>{
    const getSuperId = await userService.findUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isDeleted: false, status: true }, {});
    console.log("getSuperId++++++++++++++++++++++", getSuperId)
    return getSuperId.map(ID => ID._id);
}


exports.getUserEmails= async()=>{
    const getSuperEmails = await userService.findUser({ roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isPrimary: true }, {notificationTo:1});
    return getSuperEmails[0]?.notificationTo
}

exports.getPrimaryUser = async(query)=>{
    const getSuperId = await userService.getUserById1(query, {});
    return getSuperId

}

// module.exports = getUserIds;
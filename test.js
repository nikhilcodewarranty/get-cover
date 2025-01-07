const user = require("./models/User/users")



let updatePassword = async (req, res) => {
    let kkk = await user.updateMany({ dialCode: "+1" }, { password: "$2b$10$Qw./0YhZewHLTH3YGtdzjuodxZV5jGMuIWaXsDr5dWYuM64BfCL5K" }, { new: true })
    // let kkk = await user.find()
    console.log("updatePassword++++++++++++++++++++++",kkk)
}

updatePassword()
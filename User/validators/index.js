//* validators/index.js
const login_validation = require('./login_validation')
const add_role_validation = require('./add_role_validation')
const create_dealer_validation = require('./create_dealer_validation')

module.exports = {
    login_validation,
    add_role_validation,
    create_dealer_validation
}

//* validators/index.js
const login_validation = require('./login_validation')
const add_role_validation = require('./add_role_validation')
const create_dealer_validation = require('./create_dealer_validation')
const create_service_provider_validation = require('./create_service_provider')
const send_email_link_validation = require('./send_email_link')

module.exports = {
    login_validation,
    add_role_validation,
    create_dealer_validation,
    create_service_provider_validation,
    send_email_link_validation
}

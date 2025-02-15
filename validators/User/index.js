//* validators/index.js
const login_validation = require('./login_validation')
const add_role_validation = require('./add_role_validation')
const create_dealer_validation = require('./create_dealer_validation')
const approve_dealer_validation = require('./approve_validation')
const create_service_provider_validation = require('./create_service_provider')
const email_validation = require('./email_validation')
const send_email_link_validation = require('./send_email_link')
const approve_reject_dealer_validation = require('./approve_reject_dealer')
const filter_dealer = require('./filter_dealer')
module.exports = {
    login_validation,
    add_role_validation,
    create_dealer_validation,
    create_service_provider_validation,
    send_email_link_validation,
    approve_reject_dealer_validation,
    email_validation,
    approve_dealer_validation,
    filter_dealer
}

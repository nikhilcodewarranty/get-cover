const update_dealer_price_validation = require('./Dealer/update_dealer_price')
const create_dealer_price_book_validation = require('./Dealer/create_dealer_price_book')
const register_dealer = require('./Dealer/register_dealer')
const change_status_dealer = require('./Dealer/change_status_dealer')
const filter_dealer_price = require('./Dealer/filter_dealer_price')
const create_reseller = require('./Dealer/create_reseller')
const create_customer = require('./Dealer/create_customer')
const createCustomerValidation = require('./Customer/create_customer')
const create_price_cat_validation = require('./PriceBook/create_price_cat')
const update_price_cat_validation = require('./PriceBook/update_price_cat')
const create_price_validation = require('./PriceBook/create_price')
const update_price_validation = require('./PriceBook/update_price')
const search_price_cat_validation = require('./PriceBook/saerch_price_cat')
const search_price_book_validation = require('./PriceBook/search_price_book')
const filter_price_cat = require('./PriceBook/filter_price_cat')
const filter_price_book = require('./PriceBook/filter_price_book')
const register_servicer_validation = require('./Provider/servicer_register')
const create_servicer_validation = require('./Provider/create_servicer')
const login_validation = require('./User/login_validation')
const add_role_validation = require('./User/add_role_validation')
const create_dealer_validation = require('./User/create_dealer_validation')
const approve_dealer_validation = require('./User/approve_validation')
const create_service_provider_validation = require('./User/create_service_provider')
const email_validation = require('./User/email_validation')
const send_email_link_validation = require('./User/send_email_link')
const approve_reject_dealer_validation = require('./User/approve_reject_dealer')
const filter_dealer = require('./User/filter_dealer')


module.exports = {
    update_dealer_price_validation,
    create_dealer_price_book_validation,
    register_dealer,
    change_status_dealer,
    filter_price_book,
    filter_dealer_price,
    create_reseller,
    create_customer,
    createCustomerValidation,
    create_price_cat_validation,
    update_price_cat_validation,
    create_price_validation,
    update_price_validation,
    search_price_cat_validation,
    filter_price_book,
    search_price_book_validation,
    filter_price_cat,
    register_servicer_validation,
    create_servicer_validation,
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
const update_dealer_price_validation = require('./update_dealer_price')
const create_dealer_price_book_validation = require('./create_dealer_price_book')
const register_dealer = require('./register_dealer')
const change_status_dealer = require('./change_status_dealer')
const filter_price_book= require('./filter_price_book')
const filter_dealer_price= require('./filter_dealer_price')
const create_reseller= require('./create_reseller')



module.exports = {
    update_dealer_price_validation,
    create_dealer_price_book_validation,
    register_dealer,
    change_status_dealer,
    filter_price_book,
    filter_dealer_price,
    create_reseller
}
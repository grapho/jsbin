'use strict';
var stripe = require('stripe');
var Promise = require('promise');
var validateVAT = require('validate-vat');
var utils = require('../utils');

module.exports = function (stripe) {

  return function (req, event, done) {

    var data = event.data.object;
    var customer_id = data.customer;
    var invoice_id = data.id;

    // if the invoice has been paid don't add VAT
    // e.g. when it is the first invoice.
    if (data.paid) {
      return done(null);
    }

    stripe.customers.retrieve(customer_id, function (err, customer) {
      var country = utils.getCountry(customer);
      if (utils.countryIsInEU(country) === false) {
        return done(null);
      }

      function applyVAT() {
        utils.getVATByCountry(country).then(function (VAT) {
          stripe.invoiceItems.create({
            customer: customer_id,
            invoice: invoice_id,
            amount: data.total * VAT,
            currency: 'gbp',
            description: 'VAT',
          }, function (err, invoiceItem) {
            if (err) {
              return done(err);
            }
            done(null);
          });
        });
      }

      var VATIN = customer.metadata.vat;

      if (VATIN) {
        validateVAT(country, VATIN, function (err, result) {
          if (err) {
            return done(err);
          }
          if (result.valid) {
            return done(null);
          } else {
            applyVAT();
          }
        });
      } else {
        applyVAT();
      }


    });

  };

};
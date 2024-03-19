const { Customer } = require("../model/customer");
const customerResourceResponse = require("../utils/constant");
const customerService = require("../services/customerService");
let dealerService = require('../../Dealer/services/dealerService')
let resellerService = require('../../Dealer/services/resellerService')
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
let contractService = require('../../Contract/services/contractService')
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
let userService = require('../../User/services/userService')
let servicerService = require('../../Provider/services/providerService')
let orderService = require('../../Order/services/orderService')
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const serviceProvider = require("../../Provider/model/serviceProvider");


exports.customerOrders = async (req, res) => {
  try {
    let data = req.body
    console.log("req.userId", req.userId)
    let checkCustomer = await customerService.getCustomerById({ _id: req.userId }, {})
    if (!checkCustomer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
      return;
    }

    let project = {
      productsArray: 1,
      dealerId: 1,
      unique_key: 1,
      unique_key_number: 1,
      unique_key_search: 1,
      servicerId: 1,
      customerId: 1,
      serviceCoverageType: 1,
      coverageType: 1,
      resellerId: 1,
      paymentStatus: 1,
      status: 1,
      createdAt: 1,
      venderOrder: 1,
      orderAmount: 1,
      contract: "$contract"
    };

    let query = { status: { $ne: "Archieved" }, customerId: new mongoose.Types.ObjectId(req.userId) };

    let lookupQuery = [
      {
        $match: query
      },
      // {
      //   $lookup: {
      //     from: "contracts",
      //     localField: "_id",
      //     foreignField: "orderId",
      //     as: "contract"
      //   }
      // },
      {
        $project: project,
      },
      {
        "$addFields": {
          "noOfProducts": {
            "$sum": "$productsArray.checkNumberProducts"
          },
          totalOrderAmount: { $sum: "$orderAmount" },
          flag: {
            $cond: {
              if: {
                $and: [
                  // { $eq: ["$payment.status", "paid"] },
                  { $ne: ["$productsArray.orderFile.fileName", ''] },
                  { $ne: ["$customerId", null] },
                  { $ne: ["$paymentStatus", 'Paid'] },
                  { $ne: ["$productsArray.coverageStartDate", null] },
                ]
              },
              then: true,
              else: false
            }
          }
        }
      },
      { $sort: { unique_key: -1 } }
    ]



    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)


    let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);

    //let ordersResult = await orderService.getAllOrders({ customerId: new mongoose.Types.ObjectId(req.userId), status: { $ne: "Archieved" } }, { isDeleted: 0 })

    //Get Respective dealer
    let dealerIdsArray = ordersResult.map((result) => result.dealerId);
    const dealerCreateria = { _id: { $in: dealerIdsArray } };

    let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
    let userResellerIds = ordersResult
      .filter(result => result.resellerId !== null)
      .map(result => result.resellerId.toString());

    let mergedArray = userDealerIds.concat(userResellerIds);
    //Get Respective Dealers
    let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
      name: 1,
      isServicer: 1,
    });
    //Get Order Customer
    let customerIdsArray = ordersResult.map((result) => result.customerId);
    const customerCreteria = { _id: { $in: customerIdsArray } };
    let respectiveCustomer = await customerService.getAllCustomers(
      customerCreteria,
      { username: 1 }
    );
    //Get Respective Reseller

    let resellerIdsArray = ordersResult.map((result) => result.resellerId);
    const resellerCreteria = { _id: { $in: resellerIdsArray } };
    let respectiveReseller = await resellerService.getResellers(
      resellerCreteria,
      { name: 1, isServicer: 1 }
    );

    let userCustomerIds = ordersResult
      .filter(result => result.customerId !== null)
      .map(result => result.customerId.toString());

    const allUserIds = mergedArray.concat(userCustomerIds);


    const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

    let getPrimaryUser = await userService.findUserforCustomer(queryUser)

    let servicerIdArray = ordersResult.map((result) => result.servicerId);
    const servicerCreteria = {
      $or: [
        { _id: { $in: servicerIdArray } },
        { resellerId: { $in: servicerIdArray } },
        { dealerId: { $in: servicerIdArray } },
      ],
    };
    //Get Respective Servicer
    let respectiveServicer = await servicerService.getAllServiceProvider(
      servicerCreteria,
      { name: 1 }
    );
    const result_Array = ordersResult.map((item1) => {
      const dealerName =
        item1.dealerId != ""
          ? respectiveDealers.find(
            (item2) => item2._id.toString() === item1.dealerId.toString()
          )
          : null;
      const servicerName =
        item1.servicerId != null
          ? respectiveServicer.find(
            (item2) =>
              item2._id.toString() === item1.servicerId.toString() ||
              item2.resellerId === item1.servicerId
          )
          : null;
      const customerName =
        item1.customerId != null
          ? respectiveCustomer.find(
            (item2) => item2._id.toString() === item1.customerId.toString()
          )
          : null;
      const resellerName =
        item1.resellerId != null
          ? respectiveReseller.find(
            (item2) => item2._id.toString() === item1.resellerId.toString()
          )
          : null;
      if (dealerName || customerName || servicerName || resellerName) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerName: servicerName ? servicerName.toObject() : {},
          dealerName: dealerName ? dealerName.toObject() : dealerName,
          customerName: customerName ? customerName.toObject() : {},
          resellerName: resellerName ? resellerName.toObject() : {},
        };
      } else {
        return {
          dealerName: dealerName.toObject(),
          servicerName: servicerName.toObject(),
          customerName: customerName.toObject(),
          resellerName: resellerName.toObject(),
        };
      }
    });

    const unique_keyRegex = new RegExp(
      data.unique_key ? data.unique_key.trim() : "",
      "i"
    );
    const venderOrderRegex = new RegExp(
      data.venderOrder ? data.venderOrder.trim() : "",
      "i"
    );
    const status = new RegExp(data.status ? data.status.trim() : "", "i");

    let filteredData = result_Array.filter((entry) => {
      return (
        unique_keyRegex.test(entry.unique_key) &&
        venderOrderRegex.test(entry.venderOrder) &&
        status.test(entry.status)
      );
    });
    // const updatedArray = filteredData.map((item) => ({
    //   ...item,
    //   servicerName: item.dealerName.isServicer
    //     ? item.dealerName
    //     : item.resellerName.isServicer
    //       ? item.resellerName
    //       : item.servicerName,
    // }));

    const updatedArray = filteredData.map(item => {
      let username = null; // Initialize username as null
      let resellerUsername = null
      let customerUserData = null
      let isEmptyStartDate = item.productsArray.map(
        (item1) => item1.coverageStartDate === null
      );
      let isEmptyOrderFile = item.productsArray
        .map(
          (item1) =>
            item1.orderFile.fileName === ""
        )
      item.flag = false
      const coverageStartDate = isEmptyStartDate.includes(true) ? false : true
      const fileName = isEmptyOrderFile.includes(true) ? false : true
      if (item.customerId != null && coverageStartDate && fileName && item.paymentStatus != 'Paid') {
        item.flag = true
      }
      if (item.dealerName) {
        username = getPrimaryUser.find(user => user.accountId.toString() === item.dealerName._id.toString());
      }
      if (item.resellerName) {
        resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.resellerName._id.toString()) : {};
      }
      if (item.customerName) {
        customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.customerName._id.toString()) : {};
      }
      return {
        ...item,
        servicerName: item.dealerName.isServicer && item.servicerId != null ? item.dealerName : item.resellerName.isServicer && item.servicerId != null ? item.resellerName : item.servicerName,
        username: username, // Set username based on the conditional checks
        resellerUsername: resellerUsername ? resellerUsername : {},
        customerUserData: customerUserData ? customerUserData : {}
      };
    });

    const orderIdRegex = new RegExp(data.orderId ? data.orderId : '', 'i')
    const venderRegex = new RegExp(data.venderOrder ? data.venderOrder : '', 'i')
    const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName : '', 'i')
    const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName : '', 'i')
    const customerNameRegex = new RegExp(data.customerName ? data.customerName : '', 'i')
    const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName : '', 'i')
    const statusRegex = new RegExp(data.status ? data.status : '', 'i')

    const filteredData1 = updatedArray.filter(entry => {
      return (
        venderRegex.test(entry.venderOrder) &&
        orderIdRegex.test(entry.unique_key) &&
        dealerNameRegex.test(entry.dealerName.name) &&
        servicerNameRegex.test(entry.servicerName.name) &&
        customerNameRegex.test(entry.customerName.name) &&
        resellerNameRegex.test(entry.resellerName.name) &&
        statusRegex.test(entry.status)
      );
    });


    res.send({
      code: constant.successCode,
      message: 'Success',
      result: filteredData1
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getSingleOrder = async (req, res) => {
  try {
    // if (req.role != "Super Admin") {
    //     res.send({
    //         code: constant.errorCode,
    //         message: "Only super admin allow to do this action",
    //     });
    //     return;
    // }
    let projection = { isDeleted: 0 };
    let query = { _id: req.params.orderId };
    let checkOrder = await orderService.getOrder(query, projection);
    if (!checkOrder) {
      res.send({
        code: constant.errorCode,
        message: "Order not found!",
      });
      return;
    }
    checkOrder = checkOrder.toObject();
    checkOrder.productsArray = await Promise.all(checkOrder.productsArray.map(async (product) => {
      const pricebook = await priceBookService.findByName1({ _id: product.priceBookId });
      const pricebookCat = await priceBookService.getPriceCatByName({ _id: product.categoryId });
      if (pricebook) {
        product.name = pricebook.name;
      }
      if (pricebookCat) {
        product.catName = pricebookCat.name;
      }

      return product;
    }));


    // return
    //Get Dealer Data

    let dealer = await dealerService.getDealerById(checkOrder.dealerId, { isDeleted: 0 });

    //Get customer Data
    let customer = await customerService.getCustomerById({ _id: checkOrder.customerId }, { isDeleted: 0 });
    //Get Reseller Data
    let reseller = await resellerService.getReseller({ _id: checkOrder.resellerId }, { isDeleted: 0 })
    //Get Servicer Data
    let query1 = {
      $or: [
        { _id: checkOrder.servicerId },
        { resellerId: checkOrder.servicerId != null ? checkOrder.servicerId : '' },
        { dealerId: checkOrder.servicerId != null ? checkOrder.servicerId : '' },
      ],
    };
    let checkServicer = await servicerService.getServiceProviderById(query1);
    let singleDealerUser = await userService.getUserById1({ accountId: checkOrder.dealerId, isPrimary: true }, { isDeleted: false });
    let singleResellerUser = await userService.getUserById1({ accountId: checkOrder.resellerId, isPrimary: true }, { isDeleted: false });
    let singleCustomerUser = await userService.getUserById1({ accountId: checkOrder.customerId, isPrimary: true }, { isDeleted: false });


    // ------------------------------------Get Dealer Servicer -----------------------------
    let getServicersIds = await dealerRelationService.getDealerRelations({
      dealerId: checkOrder.dealerId,
    });
    let ids = getServicersIds.map((item) => item.servicerId);
    servicer = await servicerService.getAllServiceProvider(
      { _id: { $in: ids }, status: true },
      {}
    );
    if (checkOrder.resellerId != null) {
      var checkReseller = await resellerService.getReseller({
        _id: checkOrder.resellerId,
      });
    }
    if (reseller && reseller.isServicer) {
      servicer.unshift(reseller);
    }

    if (dealer && dealer.isServicer) {
      servicer.unshift(dealer);
    }
    const servicerIds = servicer.map((obj) => obj._id);
    const servicerQuery = { accountId: { $in: servicerIds }, isPrimary: true };

    let servicerUser = await userService.getMembers(servicerQuery, {});
    const result_Array = servicer.map((item1) => {
      const matchingItem = servicerUser.find(
        (item2) => item2.accountId.toString() === item1._id.toString()
      );

      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerData: matchingItem.toObject(),
        };
      } else {
        return servicer.toObject();
      }
    });
    let userData = {
      dealerData: dealer ? dealer : {},
      customerData: customer ? customer : {},
      resellerData: reseller ? reseller : {},
      username: singleDealerUser ? singleDealerUser : {},
      resellerUsername: singleResellerUser ? singleResellerUser : {},
      customerUserData: singleCustomerUser ? singleCustomerUser : {},
      servicerData: checkServicer ? checkServicer : {},
    };

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: checkOrder,
      orderUserData: userData,
      servicers: result_Array
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message,
    });
  }
};



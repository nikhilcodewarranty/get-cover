const { Customer } = require("../model/customer");
const customerResourceResponse = require("../utils/constant");
const customerService = require("../services/customerService");
let dealerService = require('../../Dealer/services/dealerService')
let resellerService = require('../../Dealer/services/resellerService')
const dealerRelationService = require("../../Dealer/services/dealerRelationService");
let contractService = require('../../Contract/services/contractService')
let claimService = require('../../Claim/services/claimService')
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerPriceService = require("../../Dealer/services/dealerPriceService");
let userService = require('../../User/services/userService')
let servicerService = require('../../Provider/services/providerService')
let orderService = require('../../Order/services/orderService')
const constant = require("../../config/constant");
const { default: mongoose } = require("mongoose");
const serviceProvider = require("../../Provider/model/serviceProvider");
const reportingController = require('../../User/controller/reportingController')

const LOG = require('../../User/model/logs')

// orders API's
exports.customerOrders = async (req, res) => {
  try {
    let data = req.body
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
      {
        name: 1,
        city: 1,
        state: 1,
        country: 1,
        zip: 1,
        street: 1,
        dealerId: 1,
        resellerId: 1
      }
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
              item2._id.toString() === item1.servicerId?.toString() ||
              item2.resellerId?.toString() === item1?.servicerId?.toString() || item2.dealerId?.toString() === item1?.servicerId?.toString()
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
      data.unique_key ? data.unique_key.replace(/\s+/g, ' ').trim() : "",
      "i"
    );
    const venderOrderRegex = new RegExp(
      data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : "",
      "i"
    );
    const status = new RegExp(data.status ? data.status.replace(/\s+/g, ' ').trim() : "", "i");

    let filteredData = result_Array.filter((entry) => {
      return (
        unique_keyRegex.test(entry.unique_key) &&
        venderOrderRegex.test(entry.venderOrder) &&
        status.test(entry.status)
      );
    });

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
        servicerName: (item.dealerName.isServicer && item.servicerId?.toString() == item.dealerName._id?.toString()) ? item.dealerName : (item.resellerName.isServicer && item.servicerId?.toString() == item.resellerName._id?.toString()) ? item.resellerName : item.servicerName,
        username: username, // Set username based on the conditional checks
        resellerUsername: resellerUsername ? resellerUsername : {},
        customerUserData: customerUserData ? customerUserData : {}
      };
    });

    const orderIdRegex = new RegExp(data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', 'i')
    const venderRegex = new RegExp(data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', 'i')
    const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const customerNameRegex = new RegExp(data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', 'i')
    const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
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

// get single order api
exports.getSingleOrder = async (req, res) => {
  try {
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
        product.pName = pricebook.pName;
        product.term = pricebook.term;
      }
      if (pricebookCat) {
        product.catName = pricebookCat.name;
        product.pName = pricebook.pName;
        product.term = pricebook.term;
      }

      return product;
    }));

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

//edit customer api
exports.editCustomer = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await customerService.getCustomerById({ _id: req.userId }, {})
    if (!checkDealer) {
       res.send({
        code: constant.errorCode,
        message: "Invalid ID"
      })
      return;
    };

    let criteria1 = { _id: checkDealer._id }
    let option = { new: true }
    let updateCustomer = await customerService.updateCustomer(criteria1, data, option)
    if (!updateCustomer) {
       res.send({
        code: constant.errorCode,
        message: "Unable to update the customer detail"
      })
      return;
    }

    if (data.isAccountCreate) {
      let updatePrimaryUser = await userService.updateSingleUser({ accountId: checkDealer._id, isPrimaryUser: true }, { stauts: true }, { new: true })
    } else {
      let updatePrimaryUser = await userService.updateUser({ accountId: checkDealer._id }, { stauts: false }, { new: true })

    }

    res.send({
      code: constant.successCode,
      message: "Updated successfully"
    })
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get customer contracts api
exports.getCustomerContract = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let dealerIds = [];
    let customerIds = [];
    let resellerIds = [];
    let servicerIds = [];
    let userSearchCheck = 1
    if (data.servicerName != "") {
      userSearchCheck = 1
      let getData = await servicerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        servicerIds = await getData.map(servicer => servicer._id)
        let asServicer = (await getData).reduce((acc, servicer) => {
          if (servicer.resellerId !== null && servicer.dealerId === null) {
            acc.push(servicer.resellerId);
          } else if (servicer.dealerId !== null && servicer.resellerId === null) {
            acc.push(servicer.dealerId);
          }
          return acc;
        }, []);
        servicerIds = servicerIds.concat(asServicer)
      } else {
        servicerIds.push("1111121ccf9d400000000000")
      }
    };

    let orderAndCondition = []
    if (servicerIds.length > 0) {
      orderAndCondition.push({ servicerId: { $in: servicerIds } })
    }

    orderAndCondition.push({ customerId: { $in: [req.userId] } })

    let orderIds = []
    if (orderAndCondition.length > 0) {
      let getOrders = await orderService.getOrders({
        $and: orderAndCondition
      })
      if (getOrders.length > 0) {
        orderIds = await getOrders.map(order => order._id)
      }
    }
    let contractFilterWithEligibilty = []
    if (data.eligibilty != '') {
      contractFilterWithEligibilty = [
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { eligibilty: data.eligibilty === "true" ? true : false },
        { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      ]
    } else {
      contractFilterWithEligibilty = [
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      ]
    }

    if (userSearchCheck == 1) {
      contractFilterWithEligibilty.push({ orderId: { $in: orderIds } })
    }
    let mainQuery = []
    if (data.contractId === "" && data.productName === "" && data.pName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        {
          $facet: {
            totalRecords: [
              {
                $count: "total"
              }
            ],
            data: [
              {
                $skip: skipLimit
              },
              {
                $limit: pageLimit
              },
              {
                $project: {
                  productName: 1,
                  model: 1,
                  serial: 1,
                  minDate: 1,
                  unique_key: 1,
                  productValue: 1,
                  status: 1,
                  manufacture: 1,
                  eligibilty: 1,
                  orderUniqueKey: 1,
                  venderOrder: 1,
                  totalRecords: 1
                }
              }
            ],
          },

        },
      ]
    } else {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        {
          $match:
          {
            $and: contractFilterWithEligibilty
          },
        },

      ]
      mainQuery.push({
        $facet: {
          totalRecords: [
            {
              $count: "total"
            }
          ],
          data: [
            {
              $skip: skipLimit
            },
            {
              $limit: pageLimit
            },
            {
              $project: {
                productName: 1,
                model: 1,
                serial: 1,
                minDate: 1,
                unique_key: 1,
                productValue: 1,
                status: 1,
                manufacture: 1,
                eligibilty: 1,
                orderUniqueKey: 1,
                venderOrder: 1,
                totalRecords: 1
              }
            }
          ],
        },

      })
    }


    let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
    let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0
    let result1 = getContracts[0]?.data ? getContracts[0]?.data : []
    for (let e = 0; e < result1.length; e++) {
      result1[e].reason = " "
      if (result1[e].status != "Active") {
        result1[e].reason = "Contract is not active"
      }
      if (new Date(result1[e].minDate) > new Date()) {
        const options = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        };
        const formattedDate = new Date(result1[e].minDate).toLocaleDateString('en-US', options)
        result1[e].reason = "Contract will be eligible on " + " " + formattedDate
      }
      let claimQuery = [
        {
          $match: { contractId: new mongoose.Types.ObjectId(result1[e]._id) }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" }, // Calculate total amount from all claims
            openFileClaimsCount: { // Count of claims where claimfile is "Open"
              $sum: {
                $cond: {
                  if: { $eq: ["$claimFile", "Open"] }, // Assuming "claimFile" field is correct
                  then: 1,
                  else: 0
                }
              }
            }
          }
        }
      ]

      let checkClaims = await claimService.getClaimWithAggregate(claimQuery)
      if (checkClaims[0]) {
        if (checkClaims[0].openFileClaimsCount > 0) {
          result1[e].reason = "Contract has open claim"

        }
        if (checkClaims[0].totalAmount >= result1[e].productValue) {
          result1[e].reason = "Claim value exceed the product value limit"
        }
      }
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: result1,
      totalCount,
      mainQuery
    })

  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//users api's
exports.addCustomerUser = async (req, res) => {
  try {
    let data = req.body
    let checkCustomer = await customerService.getCustomerByName({ _id: req.userId })
    if (!checkCustomer) {
       res.send({
        code: constant.errorCode,
        message: "Invalid customer"
      })
      return;
    }
    let checkEmail = await userService.findOneUser({ email: data.email })
    if (checkEmail) {
       res.send({
        code: constant.errorCode,
        message: "User already added with this email"
      })
      return;
    };

    data.accountId = checkCustomer._id
    data.metaId = checkCustomer._id
    data.roleId = process.env.customer
    let saveData = await userService.createUser(data)
    if (!saveData) {
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "addCustomerUser",
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to add the user"
        }
      }

      await LOG(logData).save()

       res.send({
        code: constant.errorCode,
        message: "Unable to add the user"
      })
    } else {
      //Save Logs
      let logData = {
        userId: req.userId,
        endpoint: "addCustomerUser",
        body: data,
        response: {
          code: constant.successCode,
          message: "User added successfully",
          result: saveData
        }
      }

      await LOG(logData).save()
      res.send({
        code: constant.successCode,
        message: "User added successfully",
        result: saveData
      })
    }


  } catch (err) {
    //Save Logs
    let logData = {
      userId: req.userId,
      endpoint: "addCustomerUser catch",
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }

    await LOG(logData).save()
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//get custiner users
exports.getCustomerUsers = async (req, res) => {
  try {
    let data = req.body
    let getCustomerUsers = await userService.findUser({ accountId: req.userId, isDeleted: false }, { isPrimary: -1 })
    if (!getCustomerUsers) {
       res.send({
        code: constant.errorCode,
        message: "Unable to fetch the customers"
      })
      return;
    }

    let name = data.firstName ? data.firstName : ""
    let nameArray = name.split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };

    const firstNameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
    const lastNameRegex = new RegExp(data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = getCustomerUsers.filter(entry => {
      return (
        firstNameRegex.test(entry.firstName) &&
        lastNameRegex.test(entry.lastName) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });

    let checkCustomer = await customerService.getCustomerByName({ _id: req.userId }, { status: 1 })
    if (!checkCustomer) {
       res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
      return;
    };


    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData,
      customerStatus: checkCustomer.status,
      isAccountCreate: checkCustomer.isAccountCreate
    })
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// change primary user 
exports.changePrimaryUser = async (req, res) => {
  try {
    let data = req.body
    let checkUser = await userService.findOneUser({ _id: req.params.userId }, {})
    if (!checkUser) {
       res.send({
        code: constant.errorCode,
        message: "Unable to find the user"
      })
      return;
    };
    let updateLastPrimary = await userService.updateSingleUser({ accountId: checkUser.accountId, isPrimary: true }, { isPrimary: false }, { new: true })
    if (!updateLastPrimary) {
      //Save Logs changePrimaryUser
      let logData = {
        endpoint: "changePrimaryUser",
        userId: req.userId,
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to change tha primary"
        }
      }
      await LOG(logData).save()

       res.send({
        code: constant.errorCode,
        message: "Unable to change tha primary"
      })
      return;
    };
    let updatePrimary = await userService.updateSingleUser({ _id: checkUser._id }, { isPrimary: true }, { new: true })
    if (!updatePrimary) {
      //Save Logs changePrimaryUser
      let logData = {
        endpoint: "changePrimaryUser",
        userId: req.userId,
        body: data,
        response: {
          code: constant.errorCode,
          message: "Something went wrong",
          result: updatePrimary
        }
      }
      await LOG(logData).save()

       res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      })
    } else {
      //Save Logs changePrimaryUser
      let logData = {
        endpoint: "changePrimaryUser",
        userId: req.userId,
        body: data,
        response: {
          code: constant.successCode,
          message: "Updated successfully",
          result: updatePrimary
        }
      }

      await LOG(logData).save()
      res.send({
        code: constant.successCode,
        message: "Updated successfully",
        result: updatePrimary
      })
    }

  } catch (err) {
    //Save Logs changePrimaryUser
    let logData = {
      endpoint: "changePrimaryUser catch",
      userId: req.userId,
      body: req.body ? req.body : { "type": "Catch Error" },
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await LOG(logData).save()

     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get customer by ID/token
exports.getCustomerById = async (req, res) => {
  try {
    let data = req.body
    let checkCustomer = await customerService.getCustomerById({ _id: req.userId }, {})
    if (!checkCustomer) {
       res.send({
        code: constant.errorCode,
        message: "Invalid customer ID"
      })
    } else {
      let getPrimaryUser = await userService.findOneUser({ accountId: checkCustomer._id.toString(), isPrimary: true }, {})
      let checkReseller = await resellerService.getReseller({ _id: checkCustomer.resellerId }, { isDeleted: 0 });
      let project = {
        productsArray: 1,
        dealerId: 1,
        unique_key: 1,
        servicerId: 1,
        customerId: 1,
        resellerId: 1,
        paymentStatus: 1,
        status: 1,
        venderOrder: 1,
        orderAmount: 1,
      }


      let orderQuery = { customerId: { $in: [checkCustomer._id] }, status: "Active" }
      let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, "$customerId");


      res.send({
        code: constant.successCode,
        message: "Success",
        result: {
          meta: checkCustomer,
          primary: getPrimaryUser,
          resellerName: checkReseller ? checkReseller.name : '',
          resellerStatus: checkReseller ? checkReseller.status : null,
          orderData: ordersResult
        }
      })

    }
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get order contract by ID
exports.getOrderContract = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let query = [
      {
        $match: { orderId: new mongoose.Types.ObjectId(req.params.orderId) }
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
    ]
    let checkOrder = await contractService.getContracts(query, skipLimit, limitData)
    let totalContract = await contractService.findContractCount({ orderId: new mongoose.Types.ObjectId(req.params.orderId) }, skipLimit, pageLimit)
    if (!checkOrder[0]) {
      res.send({
        code: constant.successCode,
        message: "Success!",
        result: checkOrder,
        contractCount: 0,
        orderUserData: {}
      })
      return
    }

    // checkOrder = checkOrder;
    let arrayToPromise = checkOrder[0] ? checkOrder[0].order[0].productsArray : []
    checkOrder.productsArray = await Promise.all(arrayToPromise.map(async (product) => {
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
    let dealer = await dealerService.getDealerById(checkOrder[0].order[0] ? checkOrder[0].order[0].dealerId : '', { isDeleted: 0 });
    //Get customer Data
    let customer = await customerService.getCustomerById({ _id: checkOrder[0].order[0] ? checkOrder[0].order[0].customerId : '' }, { isDeleted: 0 });
    //Get Reseller Data

    let reseller = await resellerService.getReseller({ _id: checkOrder[0].order[0].resellerId }, { isDeleted: 0 })

    const queryDealerUser = { accountId: { $in: [checkOrder[0].order[0].dealerId != null ? checkOrder[0].order[0].dealerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

    const queryResselerUser = { accountId: { $in: [checkOrder[0].order[0].resellerId != null ? checkOrder[0].order[0].resellerId.toString() : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000")] }, isPrimary: true };

    let dealerUser = await userService.findUserforCustomer(queryDealerUser)

    let resellerUser = await userService.findUserforCustomer(queryResselerUser)

    //Get Servicer Data

    let query1 = {
      $or: [
        { _id: checkOrder[0].order[0].servicerId ? checkOrder[0].order[0].servicerId : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000") },
      ],
    };

    let checkServicer = await servicerService.getServiceProviderById(query1);

    let userData = {
      dealerData: dealer ? dealer : {},
      customerData: customer ? customer : {},
      resellerData: reseller ? reseller : {},
      servicerData: checkServicer ? checkServicer : {},
      username: dealerUser ? dealerUser[0] : {}, // Set username based on the conditional checks
      resellerUsername: resellerUser ? resellerUser[0] : {}
    };

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: checkOrder,
      totalCount: totalContract,
      orderUserData: userData
    });

  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get contract by ID
exports.getContractById = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    // Get Claim Total of the contract
    const totalCreteria = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotalQuery = [
      { $match: totalCreteria },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]
    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    let query = [
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.contractId) },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
          pipeline: [
            {
              $lookup: {
                from: "dealers",
                localField: "dealerId",
                foreignField: "_id",
                as: "dealer",
              }
            },
            {
              $lookup: {
                from: "resellers",
                localField: "resellerId",
                foreignField: "_id",
                as: "reseller",
              }
            },
            {
              $lookup: {
                from: "customers",
                localField: "customerId",
                foreignField: "_id",
                as: "customer",
              }
            },
            {
              $lookup: {
                from: "serviceproviders",
                localField: "servicerId",
                foreignField: "_id",
                as: "servicer",
              }
            },

          ],

        }
      },
    ]
    let getData = await contractService.getContracts(query, skipLimit, pageLimit)
    for (let e = 0; e < getData.length; e++) {
      getData[e].reason = " "
      if (getData[e].status != "Active") {
        getData[e].reason = "Contract is not active"
      }
      if (new Date(getData[e].minDate) > new Date()) {

        const options = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        };
        const formattedDate = new Date(getData[e].minDate).toLocaleDateString('en-US', options)
        getData[e].reason = "Contract will be eligible on " + " " + formattedDate
      }
      let claimQuery = [
        {
          $match: { contractId: new mongoose.Types.ObjectId(getData[e]._id) }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" }, // Calculate total amount from all claims
            openFileClaimsCount: { // Count of claims where claimfile is "Open"
              $sum: {
                $cond: {
                  if: { $eq: ["$claimFile", "Open"] }, // Assuming "claimFile" field is correct
                  then: 1,
                  else: 0
                }
              }
            }
          }
        }
      ]

      let checkClaims = await claimService.getClaimWithAggregate(claimQuery)
      if (checkClaims[0]) {
        if (checkClaims[0].openFileClaimsCount > 0) {
          getData[e].reason = "Contract has open claim"

        }
        if (checkClaims[0].totalAmount >= getData[e].productValue) {
          getData[e].reason = "Claim value exceed the product value limit"
        }
      }
    }
    getData[0].claimAmount = 0;
    if (claimTotal.length > 0) {
      getData[0].claimAmount = claimTotal[0]?.amount
    }


    let orderProductId = getData[0].orderProductId
    let order = getData[0].order
    for (let i = 0; i < order.length; i++) {
      let productsArray = order[i].productsArray.filter(product => product._id.toString() == orderProductId.toString())
      if (productsArray.length > 0) {
        productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0]?.priceBookId) })
        getData[0].order[i].productsArray = productsArray
      }
    }
    getData.map((data, index) => {
      if (data.order[0]?.servicerId != null) {
        if (data.order[0]?.dealer[0]?.isServicer && data.order[0]?.dealerId.toString() === data.order[0]?.servicerId.toString()) {
          data.order[0]?.servicer.push(data.order[0]?.dealer[0])
          getData[index] = data
        }
        if (data.order[0]?.reseller.length > 0) {
          if (data.order[0]?.reseller[0]?.isServicer && data.order[0]?.resellerId.toString() === data.order[0]?.servicerId.toString()) {
            data.order[0]?.servicer.push(data.order[0]?.reseller[0])
            getData[index] = data
          }

        }
      }

    })
    if (!getData) {
       res.send({
        code: constant.errorCode,
        message: "Unable to get contract"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getData[0]
    })
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get dashboard data 
exports.getDashboardData = async (req, res) => {
  try {
    let data = req.body;
    let project = {
      productsArray: 1,
      dealerId: 1,
      unique_key: 1,
      unique_key_number: 1,
      unique_key_search: 1,
      servicerId: 1,
      customerId: 1,
      resellerId: 1,
      paymentStatus: 1,
      status: 1,
      venderOrder: 1,
      orderAmount: 1,
    };

    let query = { status: 'Active', customerId: new mongoose.Types.ObjectId(req.userId) };
    const claimQuery = { claimFile: 'Completed' }
    var checkOrders_ = await orderService.getDashboardData(query, project);
    //Get claims data
    let lookupQuery = [
      {
        $match: claimQuery
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },

      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.customerId": new mongoose.Types.ObjectId(req.userId) },
          ]
        },
      },
      {
        "$group": {
          "_id": "",
          "totalAmount": {
            "$sum": {
              "$sum": "$totalAmount"
            }
          },
        },

      },
    ]
    let valueClaim = await claimService.getClaimWithAggregate(lookupQuery);

    const rejectedQuery = { claimFile: { $ne: "Rejected" } }
    //Get number of claims
    let numberOfCompleletedClaims = [
      {
        $match: claimQuery
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },

      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.customerId": new mongoose.Types.ObjectId(req.userId) },
          ]
        },
      },
    ]
    let numberOfClaims = await claimService.getClaimWithAggregate(numberOfCompleletedClaims);
    const claimData = {
      numberOfClaims: numberOfClaims.length,
      valueClaim: valueClaim.length > 0 ? valueClaim[0]?.totalAmount : 0
    }
    if (!checkOrders_[0] && numberOfClaims.length == 0 && valueClaim.length == 0) {
       res.send({
        code: constant.errorCode,
        message: "Unable to fetch order data",
        result: {
          claimData: claimData,
          orderData: {
            "_id": "",
            "totalAmount": 0,
            "totalOrder": 0
          }
        }
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: {
        claimData: claimData,
        orderData: checkOrders_[0]
      }
    })
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// get custiner details
exports.getCustomerDetails = async (req, res) => {
  try {
    let data = req.body
    let getUser = await userService.getUserById1({ _id: req.teammateId })
    let mid = new mongoose.Types.ObjectId(req.userId)
    let query = [
      {
        $match: {
          _id: mid
        }
      },
      {
        $lookup: {
          from: "dealers",
          foreignField: "_id",
          localField: "dealerId",
          as: "dealer"
        }
      },
      {
        "$lookup": {
          "let": { "userObjId": { "$toObjectId": "$resellerId" } },
          "from": "resellers",
          "pipeline": [
            { "$match": { "$expr": { "$eq": ["$_id", "$$userObjId"] } } }
          ],
          "as": "reseller"
        },

      },
      { $unwind: { path: "$dealer", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$reseller", preserveNullAndEmptyArrays: true } }
    ]
    let getCustomer = await customerService.getCustomerByAggregate(query)
    if (!getCustomer[0]) {
       res.send({
        code: constant.errorCode,
        message: "Unable to fetch the details"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Successfully fetched user details.",
      result: getCustomer[0],
      loginMember: getUser
    })
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// saker reporting for customer daily/weekly/day
exports.saleReporting = async (req, res) => {
  try {

    let bodyData = req.body

    let getOrders = await orderService.getOrders({ customerId: req.userId })
    let orderIds = getOrders.map(ID => new mongoose.Types.ObjectId(ID._id))
    bodyData.orderId = orderIds
    bodyData.dealerId = ""
    bodyData.role = req.role


    bodyData.returnValue = {
      total_broker_fee: 0,
      total_admin_fee: 0,
      total_fronting_fee: 0,
      total_reserve_future_fee: 0,
      total_contracts: 0,
      total_reinsurance_fee: 0,
      wholesale_price: 0
    };

    if (bodyData.flag == "daily") {
      let sales = await reportingController.dailySales1(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (bodyData.flag == "weekly") {
      let sales = await reportingController.weeklySales(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (bodyData.flag == "day") {
      let sales = await reportingController.daySale(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else {
      res.send({
        code: constant.successCode,
        result: [],
        message: "Invalid flag value"
      })
    }

  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message,
    })
  }
}

// claim reporting for customer dail/weekly/day
exports.claimReporting = async (req, res) => {
  try {
    let data = req.body
    let returnValue = {
      weekStart: 1,
      total_amount: 1,
      total_claim: 1,
      total_unpaid_amount: 0,
      total_unpaid_claim: 0,
      total_paid_amount: 0,
      total_paid_claim: 0,
      total_rejected_claim: 0
    };

    data.returnValue = returnValue
    data.servicerId = ""
    data.dealerId = ""
    data.customerId = req.userId
    data.role = req.role


    if (data.flag == "daily") {
      data.dealerId = req.userId
      let claim = await reportingController.claimDailyReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    } else if (data.flag == "weekly") {
      data.dealerId = req.userId
      let claim = await reportingController.claimWeeklyReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    } else if (data.flag == "day") {
      data.dealerId = req.userId
      let claim = await reportingController.claimDayReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    }
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get dash graphs claim and order
exports.getDashboardGraph = async (req, res) => {
  try {
    let data = req.body
    let endOfMonth1s = new Date();
    let startOfMonth2s = new Date(new Date().setDate(new Date().getDate() - 30));

    let startOfYear2s = new Date(new Date().setFullYear(startOfMonth2s.getFullYear() - 1));

    // let data = req.body
    let endOfMonth1 = new Date();
    let startOfMonth2 = new Date(new Date().setDate(new Date().getDate() - 30));

    let startOfMonth = new Date(startOfMonth2.getFullYear(), startOfMonth2.getMonth(), startOfMonth2.getDate());


    let endOfMonth = new Date(endOfMonth1.getFullYear(), endOfMonth1.getMonth(), endOfMonth1.getDate() + 1);

    if (isNaN(startOfMonth) || isNaN(endOfMonth)) {
      return { code: 401, message: "invalid date" };
    }

    let datesArray = [];
    let currentDate = new Date(startOfMonth);
    while (currentDate <= endOfMonth) {
      datesArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let dailyQuery = [
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lt: endOfMonth },
          customerId: new mongoose.Types.ObjectId(req.userId),
          claimStatus: {
            $elemMatch: { status: "Completed" }
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          total_amount: { $sum: "$totalAmount" },
          total_claim: { $sum: 1 },
        }
      },
      {
        $sort: { _id: 1 } // Sort by date in ascending order
      }
    ];

    let dailyQuery1 = [
      {
        $match: {
          customerId: new mongoose.Types.ObjectId(req.userId),
          createdAt: { $gte: startOfMonth, $lt: endOfMonth },
          status: "Active"
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          order_amount: { $sum: "$orderAmount" },
          total_order: { $sum: 1 },
        }
      },
      {
        $sort: { _id: 1 } // Sort by date in ascending order
      }
    ];

    let getData = await claimService.getClaimWithAggregate(dailyQuery)
    let getData2 = await orderService.getAllOrders1(dailyQuery1)


    const result = datesArray.map(date => {
      const dateString = date.toISOString().slice(0, 10);
      const order = getData.find(item => item._id === dateString);
      return {
        weekStart: dateString,
        total_amount: order ? order.total_amount : 0,
        total_claim: order ? order.total_claim : 0,

      };
    });
    const result1 = datesArray.map(date => {
      const dateString = date.toISOString().slice(0, 10);
      const order = getData2.find(item => item._id === dateString);
      return {
        weekStart: dateString,
        order_amount: order ? order.order_amount : 0,
        total_order: order ? order.total_order : 0,


      };
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      claim_result: result,
      order_result: result1,
    })
  } catch (err) {
     res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// get last five claim and order 
exports.getDashboardInfo = async (req, res) => {
  let orderQuery = [
    {
      $match: { status: "Active", customerId: new mongoose.Types.ObjectId(req.userId) },

    },
    {
      "$addFields": {
        "noOfProducts": {
          "$sum": "$productsArray.checkNumberProducts"
        },
        totalOrderAmount: { $sum: "$orderAmount" },

      }
    },
    { $sort: { unique_key_number: -1 } },
    {
      $limit: 5
    },
  ]
  const lastFiveOrder = await orderService.getOrderWithContract1(orderQuery, 1, 5)
  const claimQuery = [
    {
      $match: {
        $and: [
          {
            customerId: new mongoose.Types.ObjectId(req.userId)
          },
          {
            claimFile: "Completed"
          }
        ]
      }
    },
    {
      $sort: {
        unique_key_number: -1
      }
    },
    {
      $limit: 5
    },
    {
      $lookup: {
        from: "contracts",
        localField: "contractId",
        foreignField: "_id",
        as: "contract"
      }
    },
    {
      $unwind: "$contract"
    },
    {
      $project: {
        unique_key: 1,
        "contract.unique_key": 1,
        unique_key_number: 1,
        totalAmount: 1
      }
    },
  ]
  const getLastNumberOfClaims = await claimService.getClaimWithAggregate(claimQuery, {})

  const result = {
    lastFiveOrder: lastFiveOrder,
    lastFiveClaims: getLastNumberOfClaims,

  }
  res.send({
    code: constant.successCode,
    result: result
  })
}



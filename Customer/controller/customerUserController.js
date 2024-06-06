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

const LOG = require('../../User/model/logs')


// orders API's
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

    // if(data.oldName != data.username){
    //   let checkName =  await customerService.getCustomerByName({username:data.username})
    //   if(checkName){
    //     res.send({
    //       code:constant.errorCode,
    //       message:"Customer already exist with this account name"
    //     })
    //     return;
    //   };
    // }
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

    // let updateDetail = await userService.updateUser({ _id: req.data.userId }, data, { new: true })
    // if (!updateDetail) {
    //   res.send({
    //     code: constant.errorCode,
    //     message: `Fail to edit`
    //   })
    //   return;
    // };
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

// contracts api
// exports.getCustomerContract = async (req, res) => {
//   try {
//     let data = req.body
//     let getCustomerOrder = await orderService.getOrders({ customerId: req.userId, status: { $in: ["Active", "Pending"] } }, { _id: 1 })
//     if (!getCustomerOrder) {
//       res.send({
//         code: constant.errorCode,
//         message: "Unable to fetch the data"
//       })
//       return
//     }
//     let orderIDs = getCustomerOrder.map((ID) => ID._id)
//     let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
//     let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
//     let limitData = Number(pageLimit)
//     let newQuery = [];
//     data.servicerName = data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : ''

//     if (data.servicerName) {
//       newQuery.push(
//         {
//           $lookup: {
//             from: "serviceproviders",
//             localField: "order.servicerId",
//             foreignField: "_id",
//             as: "order.servicer"
//           }
//         },
//         {
//           $match: {
//             $and: [
//               { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             ]
//           },
//         }
//       );
//     }
//     data.resellerName = data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : ''

//     if (data.resellerName) {
//       newQuery.push(
//         {
//           $lookup: {
//             from: "resellers",
//             localField: "order.resellerId",
//             foreignField: "_id",
//             as: "order.reseller"
//           }
//         },
//         {
//           $match: {
//             $and: [
//               { "order.reseller.name": { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             ]
//           },
//         }
//       );
//     }
//     newQuery.push(
//       {
//         $facet: {
//           totalRecords: [
//             {
//               $count: "total"
//             }
//           ],
//           data: [
//             {
//               $skip: skipLimit
//             },
//             {
//               $limit: pageLimit
//             },
//             {
//               $project: {
//                 productName: 1,
//                 model: 1,
//                 serial: 1,
//                 unique_key: 1,
//                 status: 1,
//                 manufacture: 1,
//                 eligibilty: 1,
//                 "order.unique_key": 1,
//                 "order.venderOrder": 1,
//                 "order.customerId": 1,
//                 //totalRecords: 1
//               }
//             }
//           ],
//         },

//       })

//     let contractFilter = []
//     if (data.eligibilty != '' && data.hasOwnProperty('eligibilty')) {
//       contractFilter = [
//         { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { eligibilty: data.eligibilty === "true" ? true : false },
//       ]
//     } else {
//       contractFilter = [
//         // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//         { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//         { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//       ]
//     }


//     let query = [
//       {
//         $match:
//         {
//           $and: contractFilter
//         },
//       },
//       {
//         $lookup: {
//           from: "orders",
//           localField: "orderId",
//           foreignField: "_id",
//           as: "order",
//         }
//       },
//       {
//         $unwind: {
//           path: "$order",
//           preserveNullAndEmptyArrays: true,
//         }
//       },
//       {
//         $match:
//         {
//           $and: [
//             { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//           ]
//         },

//       },
//       {
//         $lookup: {
//           from: "customers",
//           localField: "order.customerId",
//           foreignField: "_id",
//           as: "order.customer"
//         }
//       },
//       {
//         $match: {
//           $and: [
//             { "order.customer._id": new mongoose.Types.ObjectId(req.userId) },
//           ]
//         },
//       },
//       // {
//       //   $facet: {
//       //     totalRecords: [
//       //       {
//       //         $count: "total"
//       //       }
//       //     ],
//       //     data: [
//       //       {
//       //         $skip: skipLimit
//       //       },
//       //       {
//       //         $limit: pageLimit
//       //       },
//       //       {
//       //         $project: {
//       //           productName: 1,
//       //           model: 1,
//       //           serial: 1,
//       //           unique_key: 1,
//       //           status: 1,
//       //           manufacture: 1,
//       //           eligibilty: 1,
//       //           "order.unique_key": 1,
//       //           "order.venderOrder": 1
//       //         }
//       //       }

//       //     ],

//       //   },

//       // }
//     ]

//     if (newQuery.length > 0) {
//       query = query.concat(newQuery);
//     }
//     console.log(pageLimit, skipLimit, limitData)
//     let getContracts = await contractService.getAllContracts2(query)
//     //let getContract = await contractService.getAllContracts(query, skipLimit, pageLimit)
//     console.log(orderIDs, skipLimit, limitData)
//     //let totalCount = await contractService.findContractCount({ isDeleted: false, orderId: { $in: orderIDs } })
//     let totalCount = getContracts[0].totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0

//     console.log(pageLimit, skipLimit, limitData)
//     // if (!getContract) {
//     //   res.send({
//     //     code: constants.errorCode,
//     //     message: err.message
//     //   })
//     //   return;
//     // }
//     res.send({
//       code: constant.successCode,
//       message: "Success",
//       result: getContracts[0]?.data ? getContracts[0]?.data : [],
//       totalCount: totalCount
//     })

//   } catch (err) {
//     res.send({
//       code: constant.errorCode,
//       message: err.message
//     })
//   }
// }


exports.getCustomerContract = async (req, res) => {
  try {
    let data = req.body
    console.log("data------------------")
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
        let asServicer = await getData.map(servicer => {
          if (servicer.servicerId !== null && servicer.dealerId === null) {
            return servicer.servicerId;
          } else if (servicer.dealerId !== null && servicer.servicerId === null) {
            return servicer.dealerId;
          }
        })
        servicerIds = servicerIds.concat(asServicer)
      } else {
        servicerIds.push("1111121ccf9d400000000000")
      }
    };
   
    let orderAndCondition = []
    if (servicerIds.length > 0) {
      orderAndCondition.push({ servicerId: { $in: servicerIds } })
    }

    // if (req.role == 'Customer') {
    //   userSearchCheck = 1
    //   orderAndCondition.push({ customerId: { $in: [req.userId] } })
    // };
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
    console.log("getOrders-------------------")
    let contractFilterWithEligibilty = []
    if (data.eligibilty != '') {
      contractFilterWithEligibilty = [
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
        // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
        { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
    if (data.contractId === "" && data.productName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
      console.log('check_--------dssssssssssssssssssssss--------')
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
                  unique_key: 1,
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
                unique_key: 1,
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


    // console.log("sssssss", contractFilterWithPaging)

    let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
    let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getContracts[0]?.data ? getContracts[0]?.data : [],
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
    data.roleId = '656f080e1eb1acda244af8c7'
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
      body: req.body ? req.body : {"type":"Catch Error"},
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

    console.log("filteredData=================", filteredData)
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
      body: req.body ? req.body : {"type":"Catch Error"},
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

exports.getCustomerById = async (req, res) => {
  try {
    let data = req.body
    console.log("id---------------------", req.userId, req.teammateId)
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
      // {
      //     $addFields: {
      //         contracts: {
      //             $slice: ["$contracts", skipLimit, limitData] // Replace skipValue and limitValue with your desired values
      //         }
      //     }
      // }
      // { $unwind: "$contracts" }
    ]
    let checkOrder = await contractService.getContracts(query, skipLimit, limitData)
    //  console.log.log('after+++++++++++++++++++++', Date.now())
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
        // { resellerId: checkOrder[0].order[0].resellerId ? checkOrder[0].order[0].resellerId : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000") },
        // { dealerId: checkOrder[0].order[0].dealerId ? checkOrder[0].order[0].dealerId : new mongoose.Types.ObjectId("65ce1bd2279fab0000000000") },
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

exports.getContractById = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    // Get Claim Total of the contract
    const totalCreteria = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotal = await claimService.checkTotalAmount(totalCreteria);
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
    getData[0].claimAmount = 0;
    if (claimTotal.length > 0) {
      getData[0].claimAmount = claimTotal[0]?.amount
    }

    console.log("getData-------------------", getData)

    let orderProductId = getData[0].orderProductId
    let order = getData[0].order
    //res.json(order);return;
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

// exports.getDashboardData = async (req, res) => {
//   try {
//     let data = req.body
//     let query = { status: { $ne: "Archieved" }, customerId: new mongoose.Types.ObjectId(req.userId) };

//     let ordersCount = await orderService.getOrdersCount1(query)
//     let getCustomerOrder = await orderService.getOrders({ customerId: req.userId, status: { $in: ["Active", "Pending"] } }, { _id: 1 })
//     if (!getCustomerOrder) {
//       res.send({
//         code: constant.errorCode,
//         message: "Unable to fetch the data"
//       })
//       return
//     }
//     let orderIDs = getCustomerOrder.map((ID) => ID._id)
//     // let contractCount = await contractService.findContractCount({ customerId: req.userId, status: { $in: ["Active", "Pending"] } })
//     let contractCount = await contractService.findContractCount({ isDeleted: false, orderId: { $in: orderIDs } })

//     console.log("check------------", ordersCount)
//     res.send({
//       code: constant.errorCode,
//       message: "Success",
//       result: {
//         ordersCount: ordersCount,
//         contractCount: contractCount
//       }
//     })
//   } catch (err) {
//     res.send({
//       code: constant.errorCode,
//       message: err.message
//     })
//   }
// }


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
                      // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
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
      let valueClaim = await claimService.valueCompletedClaims(lookupQuery);

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
                      // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
                      { "contracts.orders.customerId": new mongoose.Types.ObjectId(req.userId) },
                  ]
              },
          },
      ]
      let numberOfClaims = await claimService.getAllClaims(numberOfCompleletedClaims);
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
              // result: {
              //     "_id": "",
              //     "totalAmount": 0,
              //     "totalOrder": 0
              // }
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
        code: Constant.errorCode,
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

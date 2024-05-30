// Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

"use strict";

const Smarthome = require("./smarthome.js");

/**
 * Let Smarthome handle the request but log request and response for debugging.
 */
exports.handler = async function (request, context) {
  let response;

  // Dump the request for debugging - check the CloudWatch logs
  console.log("==Request==");
  console.log(JSON.stringify(request, null, 4));

  if (context !== undefined) {
    // Dump the context for debugging - check the CloudWatch logs
    console.log("==Context==");
    console.log(JSON.stringify(context, null, 4));
  }

  response = await Smarthome.handler(request, context);

  // Dump the response for debugging - check the CloudWatch logs
  console.log("==Response==");
  console.log(JSON.stringify(response, null, 4));

  return response;
};

// Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

"use strict";

const superagent = require("superagent");
const constants = require("./constants.js");

// Cognito User Info Endpoint
// https://docs.aws.amazon.com/cognito/latest/developerguide/userinfo-endpoint.html
const userInfoUrl = constants.PROFILE_API_ENDPOINT;

// Call into Cognito to fetch user info and grab the email address
// for use in the partition/scope value
async function getAccountEmail(token) {
  console.log("==Begin Get Email==");

  const headers = {
    Accept: "application/json",
    Authorization: "Bearer " + token,
  };

  let response = await superagent.get(userInfoUrl).set(headers);

  if (response.ok) {
    let email = response.body.email;
    console.log("==End Get Email==");
    return email;
  } else {
    console.log("==ERROR Get Email " + response.status + " ==");
  }
}

module.exports = {
  getAccountEmail,
};

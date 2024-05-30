/*********************************************************************
Copyright 2018 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

  http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
*********************************************************************/
module.exports = Object.freeze({
  // DynamoDB Config
  DDB_REGION: "us-east-1",
  DEVICE_TABLE_NAME: "asp_sample_devices",

  // Cognito Config
  PROFILE_API_ENDPOINT: "https://cognito.novaguest.link/oauth2/userInfo",

  // Smart Home Config
  // FAHRENHEIT or CELSIUS
  TEMPERATURE_SCALE: "FAHRENHEIT",
});

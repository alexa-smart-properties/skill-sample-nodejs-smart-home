// Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

"use strict";

const {
  PutItemCommand,
  GetItemCommand,
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");
const constants = require("./constants.js");

const configDynamoDB = {
  region: constants.DDB_REGION,
};

// DynamoDB Client
const dbClient = new DynamoDBClient(configDynamoDB);

// Device Table Name
const deviceTableName = constants.DEVICE_TABLE_NAME;

/**
 * Persist the Light/PowerController state of our "dummy" devices to the DB.
 */
async function persistLight(endpoint_id, light_state_value = "OFF") {
  let item = {
    endpoint_id: { S: endpoint_id },
    light_state: { S: light_state_value },
  };
  await persistDevice(item);
}

/**
 * Persist the Blinds/ModeController state of our "dummy" devices to the DB.
 */
async function persistBlinds(endpoint_id, blinds_mode_value = "Position.Down") {
  let item = {
    endpoint_id: { S: endpoint_id },
    blinds_mode: { S: blinds_mode_value },
  };
  await persistDevice(item);
}

/**
 * Persist the ThermostatController state of our "dummy" devices to the DB.
 */
async function persistThermostat(
  endpoint_id,
  thermostat_temperature_value = "68",
  thermostat_mode_value = "AUTO"
) {
  let item = {
    endpoint_id: { S: endpoint_id },
    thermostat_temperature: { S: thermostat_temperature_value },
    thermostat_mode: { S: thermostat_mode_value },
  };
  await persistDevice(item);
}

/**
 * Persist the device state of our "dummy" devices to the DB.
 */
async function persistDevice(item) {
  let params = {
    TableName: deviceTableName,
    Item: item,
  };

  const command = new PutItemCommand(params);
  console.log("==DynamoDb PutItemCommand Request==");
  console.log(JSON.stringify(command, null, 4));
  try {
    const response = await dbClient.send(command);
    console.log("==DynamoDb PutItemCommand Result==");
    console.log(JSON.stringify(response, null, 4));
  } catch (err) {
    console.log("==DynamoDb PutItemCommand Error==");
    console.log(JSON.stringify(err, null, 4));
  }
}

/**
 * Fetch the device state of our "dummy" devices from the DB.
 */
async function retrieveDevice(endpoint_id) {
  let params = {
    TableName: deviceTableName,
    Key: {
      endpoint_id: { S: endpoint_id },
    },
    ProjectionExpression:
      "light_state,blinds_mode,thermostat_temperature,thermostat_mode",
  };
  let command = new GetItemCommand(params);
  console.log("==DynamoDb GetItemCommand Request==");
  console.log(command);
  try {
    const data = await dbClient.send(command);
    console.log("==DynamoDb GetItemCommand Result==");
    console.log(data);
    let state = {};
    state["light_state_value"] = ((data.Item || {}).light_state || {}).S;
    state["blinds_mode_value"] = ((data.Item || {}).blinds_mode || {}).S;
    state["thermostat_temperature_value"] = (
      (data.Item || {}).thermostat_temperature || {}
    ).S;
    state["thermostat_mode_value"] = (
      (data.Item || {}).thermostat_mode || {}
    ).S;
    console.log(state);
    return state;
  } catch (err) {
    console.log("==DynamoDb GetItemCommand Error==");
    console.error(err);
  }
}

module.exports = {
  persistLight,
  persistBlinds,
  persistThermostat,
  retrieveDevice,
};

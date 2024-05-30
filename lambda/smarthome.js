// Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

"use strict";

const AlexaResponse = require("./response.js");
const cognitoClient = require("./cognito.js");
const ddbClient = require("./ddb.js");
const constants = require("./constants.js");

exports.handler = async function (request, context) {
  // Validate we have an Alexa directive
  if (!("directive" in request)) {
    let aer = new AlexaResponse({
      name: "ErrorResponse",
      payload: {
        type: "INVALID_DIRECTIVE",
        message: "Missing key: directive, Is request a valid Alexa directive?",
      },
    });
    return aer.get();
  }

  // Validate the payload version
  if (Number(request.directive.header.payloadVersion) < 3) {
    let aer = new AlexaResponse({
      name: "ErrorResponse",
      payload: {
        type: "INTERNAL_ERROR",
        message: "This skill only supports Smart Home API version 3 and above",
      },
    });
    return aer.get();
  }

  // Process the directive based on the namespace, name, and instance
  const namespace = ((request.directive || {}).header || {}).namespace;
  const name = ((request.directive || {}).header || {}).name;
  const instance = ((request.directive || {}).header || {}).instance;

  // Log what we're processing for debug
  let msg = "==Namespace:" + namespace + " Name:" + name;
  msg += instance ? " Instance:" + instance : "";
  console.log("==" + msg + "==");

  let alexaResponse;

  if (namespace === "Alexa.Authorization") {
    alexaResponse = await getAuthorizationResponse(request);
  } else if (namespace === "Alexa.Discovery") {
    alexaResponse = await getDiscoveryResponse(request);
  } else if (namespace === "Alexa.PowerController") {
    alexaResponse = await processLightDirective(request);
  } else if (namespace === "Alexa.ThermostatController") {
    alexaResponse = await processThermostatDirective(request, name);
  } else if (namespace === "Alexa" && name === "ReportState") {
    alexaResponse = await getStateReportResponse(request);
  } else if (
    namespace === "Alexa.ModeController" &&
    instance === "Blinds.Position" &&
    name === "SetMode"
  ) {
    alexaResponse = await processBlindsDirective(request);
  } else {
    alexaResponse = new AlexaResponse({
      name: "ErrorResponse",
      payload: {
        type: "INTERNAL_ERROR",
        message: "Unsupported directive: " + msg,
      },
    });
  }

  return alexaResponse.get();
};

/**
 * ReportState is Alexa asking what the current state of the endpoints are for app/mm UI and
 * voice responses. Look up the state of the endpoint in the DB and report back.
 *
 * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-statereport.html
 */
async function getStateReportResponse(request) {
  console.log("==Processing ReportState==");

  const endpointId = request.directive.endpoint.endpointId;
  const deviceState = await ddbClient.retrieveDevice(endpointId);

  const temperatureValue = {
    value: Number(deviceState["thermostat_temperature_value"]),
    scale: constants.TEMPERATURE_SCALE,
  };

  let ar = new AlexaResponse({
    namespace: "Alexa",
    name: "StateReport",
    correlationToken: request.directive.header.correlationToken,
    token: request.directive.endpoint.scope.token,
    endpointId: endpointId,
    tokenType: request.directive.endpoint.scope.type,
  });

  ar.addContextProperty({}); // empty will build endpointhealth

  if (deviceState["light_state_value"]) {
    ar.addContextProperty({
      namespace: "Alexa.PowerController",
      name: "powerState",
      value: deviceState["light_state_value"],
    });
  }

  if (deviceState["blinds_mode_value"]) {
    ar.addContextProperty({
      namespace: "Alexa.ModeController",
      instance: "Blinds.Position",
      name: "mode",
      value: deviceState["blinds_mode_value"],
    });
  }

  if (deviceState["thermostat_temperature_value"]) {
    ar.addContextProperty({
      namespace: "Alexa.ThermostatController",
      name: "targetSetpoint",
      value: temperatureValue,
    });
  }

  if (deviceState["thermostat_temperature_value"]) {
    ar.addContextProperty({
      namespace: "Alexa.TemperatureSensor",
      name: "temperature",
      value: temperatureValue,
    });
  }

  if (deviceState["thermostat_mode_value"]) {
    ar.addContextProperty({
      namespace: "Alexa.ThermostatController",
      name: "thermostatMode",
      value: deviceState["thermostat_mode_value"],
    });
  }

  return ar;
}

/**
 * Device control directive from the Alexa service for ModeController. This is the blinds.
 * Just update the state in the DB and respond with success.
 *
 * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-modecontroller.html
 */
async function processBlindsDirective(request) {
  console.log("==Processing Blinds ModeController==");

  const endpointId = request.directive.endpoint.endpointId;
  const blindsModeValue = request.directive.payload.mode;

  let ar = new AlexaResponse({
    correlationToken: request.directive.header.correlationToken,
    token: request.directive.endpoint.scope.token,
    endpointId: endpointId,
    tokenType: request.directive.endpoint.scope.type,
  });
  ar.addContextProperty({
    namespace: "Alexa.ModeController",
    instance: "Blinds.Position",
    name: "mode",
    value: blindsModeValue,
  });
  await ddbClient.persistBlinds(endpointId, blindsModeValue);

  return ar;
}

/**
 * Device control directive from the Alexa service for ThermostatController. This will handle
 * the mode, set temp, and adjust temp directives.
 * Just update the state in the DB and respond with success.
 *
 * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-thermostatcontroller.html
 */
async function processThermostatDirective(request, name) {
  const endpointId = request.directive.endpoint.endpointId;
  const deviceState = await ddbClient.retrieveDevice(endpointId);

  let newTargetTemperatureValue = Number(
    deviceState.thermostat_temperature_value
  );
  let newThermostatModeValue = deviceState.thermostat_mode_value;

  if (name === "SetTargetTemperature") {
    console.log("==ProcessingThermostatController SetTargetTemperature==");
    newTargetTemperatureValue = request.directive.payload.targetSetpoint.value;
  } else if (name === "AdjustTargetTemperature") {
    console.log("==ProcessingThermostatController AdjustTargetTemperature==");
    newTargetTemperatureValue =
      newTargetTemperatureValue +
      request.directive.payload.targetSetpointDelta.value;
  } else if (name === "SetThermostatMode") {
    console.log("==ProcessingThermostatController SetThermostatMode==");
    newThermostatModeValue = request.directive.payload.thermostatMode.value;
  } else {
    console.log("==ProcessingThermostatController UNKNOWN==");
  }

  const temperatureValue = {
    value: newTargetTemperatureValue,
    scale: constants.TEMPERATURE_SCALE,
  };

  let ar = new AlexaResponse({
    correlationToken: request.directive.header.correlationToken,
    token: request.directive.endpoint.scope.token,
    tokenType: request.directive.endpoint.scope.type,
    endpointId: endpointId,
  });
  ar.addContextProperty({
    namespace: "Alexa.ThermostatController",
    name: "thermostatMode",
    value: newThermostatModeValue,
  });
  ar.addContextProperty({
    namespace: "Alexa.ThermostatController",
    name: "targetSetpoint",
    value: temperatureValue,
  });
  ar.addContextProperty({
    namespace: "Alexa.TemperatureSensor",
    name: "temperature",
    value: temperatureValue,
  });

  await ddbClient.persistThermostat(
    endpointId,
    String(newTargetTemperatureValue),
    newThermostatModeValue
  );

  return ar;
}

/**
 * Device control directive from the Alexa service for PowerController. This is the light.
 * Just update the state in the DB and respond with success.
 *
 * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-powercontroller.html
 */
async function processLightDirective(request) {
  console.log("==Processing PowerController==");

  const endpointId = request.directive.endpoint.endpointId;
  const lightStateValue =
    request.directive.header.name === "TurnOn" ? "ON" : "OFF";

  let ar = new AlexaResponse({
    correlationToken: request.directive.header.correlationToken,
    token: request.directive.endpoint.scope.token,
    endpointId: endpointId,
    tokenType: request.directive.endpoint.scope.type,
  });
  ar.addContextProperty({
    namespace: "Alexa.PowerController",
    name: "powerState",
    value: lightStateValue,
  });
  await ddbClient.persistLight(endpointId, lightStateValue);

  return ar;
}

/**
 * Authorization Grant request fires upon the skill being account linked by a customer/unit.
 * We won't be sending any proactive notifications/events to Alexa at this time so let's just
 * ACK and move on.
 *
 * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-authorization.html
 */
async function getAuthorizationResponse(request) {
  console.log("==Processing Auth==");

  return new AlexaResponse({
    namespace: "Alexa.Authorization",
    name: "AcceptGrant.Response",
    token: request.directive.payload.scope.token,
    tokenType: request.directive.payload.scope.type,
  });
}

/**
 * Discovery request fires to discover new smart home devices. We'll create an endpointId that
 * looks like {email}-{partition}-{device_type} - Each unit gets only 1 of each device type
 * to ensure easier management of sample endpointIds.
 *
 * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-discovery.html
 */
async function getDiscoveryResponse(request) {
  console.log("==Processing Discovery==");

  //
  // DELEGATED AUTH HANDLING BEGIN
  //
  // IDENTIFYING THE USER
  // 1. The token identifies the user which is account linked.
  // 2. The token can be used to look up the corresponding email address
  //    in the OAuth server.
  // 3. This email address is the primary key for segmenting device
  //    control between units.
  //
  // IDENTIFYING THE PARTITION
  // 1. The tokenType tells us if we're using Authorization Flow (BearerToken)
  //    or Delegation Flow (BearerTokenWithPartition)
  // 2. If it is delegation flow we can pull the partition value
  //    from request.directive.payload.scope.partition.
  // 3. This partition value is the secondary key for segmenting device
  //    control between units.
  //
  // USING THE USER AND PARTITION TO SEGMENT CONTROL
  // 1. In this sample we are using fake devices and will just create these
  //    dummy devices with endpointIds in the form of
  //    <EMAIL>-<PARTITION>-<DEVICE_TYPE>
  // 2. In a real world implementation you will have real serial number and
  //    and real user accounts to manage. Strategies will differ based on
  //    your existing service implementation. The key details will
  //    always be that (USER_ACCOUNT + PARTITION_VALUE) will be the
  //    'owner' of the devices in a unit, not just the USER_ACCOUNT.
  //

  // Get the token
  const token = request.directive.payload.scope.token;
  const tokenType = request.directive.payload.scope.type;

  // If we're using delegated account linking grab the partition value
  const partition =
    tokenType === "BearerTokenWithPartition"
      ? "-" + request.directive.payload.scope.partition
      : "";

  // Use the token to pull the account email from our
  // Cognito OAuth provider
  const email = await cognitoClient.getAccountEmail(token);

  // Generate the endpointId prefix and remove invalid characters
  let endpointIdPrefix = email + partition;
  endpointIdPrefix = endpointIdPrefix.replace(/\./g, "-");
  endpointIdPrefix = endpointIdPrefix.replace(/\+/g, "-");

  //
  // DELEGATED AUTH HANDLING END
  //

  let adr = new AlexaResponse({
    namespace: "Alexa.Discovery",
    name: "Discover.Response",
    token: token,
    tokenType: tokenType,
  });

  /**
   * Common Device Capabilities - used on all devices
   *
   * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-interface.html
   * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-endpointhealth.html
   */
  let alexaCapability = adr.createPayloadEndpointCapability();
  let endpointHealthCapability = adr.createPayloadEndpointCapability({
    interface: "Alexa.EndpointHealth",
    version: "3.2",
    supported: [{ name: "connectivity" }],
    retrievable: true,
    proactivelyReported: false,
  });

  /**
   * Build the LIGHT for this unit.
   * https://developer.amazon.com/en-US/docs/alexa/smarthome/get-started-with-device-templates.html#plug
   */
  let endpointId = endpointIdPrefix + "-light";
  let lightCapability = adr.createPayloadEndpointCapability({
    interface: "Alexa.PowerController",
    supported: [{ name: "powerState" }],
    retrievable: true,
    proactivelyReported: false,
  });
  let capabilities = [
    alexaCapability,
    endpointHealthCapability,
    lightCapability,
  ];
  adr.addPayloadEndpoint({
    endpointId: endpointId,
    friendlyName: "Light",
    description: "Let there be light!",
    displayCategories: ["LIGHT"],
    manufacturerName: "ASP Sample",
    capabilities: capabilities,
    additionalAttributes: {
      manufacturer: "ASP Sample",
      model: "ASP Sample Light",
      serialNumber: endpointId,
      firmwareVersion: "1.0",
      softwareVersion: "1.0",
    },
  });
  await ddbClient.persistLight(endpointId);

  /**
   * Build the BLINDS for this unit.
   * https://developer.amazon.com/en-US/docs/alexa/smarthome/get-started-with-device-templates.html#blinds
   */
  endpointId = endpointIdPrefix + "-blinds";
  let blindsCapability = adr.createPayloadEndpointBlindsCapability({
    interface: "Alexa.ModeController",
    instance: "Blinds.Position",
    version: "3",
    supported: [{ name: "mode" }],
    retrievable: true,
    proactivelyReported: false,
  });
  capabilities = [alexaCapability, endpointHealthCapability, blindsCapability];
  adr.addPayloadEndpoint({
    endpointId: endpointId,
    friendlyName: "Blinds",
    description: "Let there be dark!",
    displayCategories: ["INTERIOR_BLIND"],
    manufacturerName: "ASP Sample",
    capabilities: capabilities,
    additionalAttributes: {
      manufacturer: "ASP Sample",
      model: "ASP Sample Blinds",
      serialNumber: endpointId,
      firmwareVersion: "1.0",
      softwareVersion: "1.0",
    },
  });
  await ddbClient.persistBlinds(endpointId);

  /**
   * Build the THERMOSTAT for this unit.
   * https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-thermostatcontroller.html
   */
  endpointId = endpointIdPrefix + "-thermostat";
  let thermostatCapability = adr.createPayloadEndpointThermostatCapability({
    interface: "Alexa.ThermostatController",
    version: "3.2",
    supported: [{ name: "targetSetpoint" }, { name: "thermostatMode" }],
    retrievable: true,
    proactivelyReported: false,
  });
  let tempSensorCapability = adr.createPayloadEndpointTempSensorCapability({
    interface: "Alexa.TemperatureSensor",
    version: "3",
    supported: [{ name: "temperature" }],
    retrievable: true,
    proactivelyReported: false,
  });
  capabilities = [
    alexaCapability,
    endpointHealthCapability,
    thermostatCapability,
    tempSensorCapability,
  ];
  adr.addPayloadEndpoint({
    endpointId: endpointId,
    friendlyName: "Thermostat",
    description: "Let there be heat!",
    displayCategories: ["THERMOSTAT", "TEMPERATURE_SENSOR"],
    manufacturerName: "ASP Sample",
    capabilities: capabilities,
    additionalAttributes: {
      manufacturer: "ASP Sample",
      model: "ASP Sample Thermostat",
      serialNumber: endpointId,
      firmwareVersion: "1.0",
      softwareVersion: "1.0",
    },
  });
  await ddbClient.persistThermostat(endpointId);

  return adr;
}

// Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

"use strict";

const { v4: uuidv4 } = require("uuid");

/**
 * Helper class to generate an AlexaResponse.
 * @class
 */
class AlexaResponse {
  /**
   * Check a value for validity or return a default.
   * @param value The value being checked
   * @param defaultValue A default value if the passed value is not valid
   * @returns {*} The passed value if valid otherwise the default value.
   */
  checkValue(value, defaultValue) {
    if (value === undefined || value === {} || value === "")
      return defaultValue;

    return value;
  }

  /**
   * Constructor for an Alexa Response.
   * @constructor
   * @param opts Contains initialization options for the response
   */
  constructor(opts) {
    if (opts === undefined) opts = {};

    if (opts.context !== undefined)
      this.context = this.checkValue(opts.context, undefined);

    if (opts.event !== undefined)
      this.event = this.checkValue(opts.event, undefined);
    else
      this.event = {
        header: {
          namespace: this.checkValue(opts.namespace, "Alexa"),
          name: this.checkValue(opts.name, "Response"),
          messageId: this.checkValue(opts.messageId, uuidv4()),
          correlationToken: this.checkValue(opts.correlationToken, undefined),
          payloadVersion: this.checkValue(opts.payloadVersion, "3"),
        },
        endpoint: {
          scope: {
            type: this.checkValue(opts.tokenType, "BearerToken"),
            token: this.checkValue(opts.token, "INVALID"),
          },
          endpointId: this.checkValue(opts.endpointId, "INVALID"),
        },
        payload: this.checkValue(opts.payload, {}),
      };

    // No endpoint in an AcceptGrant or Discover request
    if (
      this.event.header.name === "AcceptGrant.Response" ||
      this.event.header.name === "Discover.Response"
    )
      delete this.event.endpoint;
  }

  /**
   * Add a property to the context.
   * @param opts Contains options for the property.
   */
  addContextProperty(opts) {
    if (this.context === undefined) this.context = { properties: [] };

    this.context.properties.push(this.createContextProperty(opts));
  }

  /**
   * Add an endpoint to the payload.
   * @param opts Contains options for the endpoint.
   */
  addPayloadEndpoint(opts) {
    if (this.event.payload.endpoints === undefined)
      this.event.payload.endpoints = [];

    this.event.payload.endpoints.push(this.createPayloadEndpoint(opts));
  }

  /**
   * Creates a property for the context. By default this will create a
   * valid Alexa.EndpointHealth property.
   * @param opts Contains options for the property.
   */
  createContextProperty(opts) {
    let prop = {
      namespace: this.checkValue(opts.namespace, "Alexa.EndpointHealth"),
      name: this.checkValue(opts.name, "connectivity"),
      value: this.checkValue(opts.value, { value: "OK" }),
      timeOfSample: new Date().toISOString(),
      uncertaintyInMilliseconds: this.checkValue(
        opts.uncertaintyInMilliseconds,
        0
      ),
    };
    if (opts.instance) {
      prop.instance = opts.instance;
    }
    return prop;
  }

  /**
   * Creates an endpoint for the payload.
   * @param opts Contains options for the endpoint.
   */
  createPayloadEndpoint(opts) {
    if (opts === undefined) opts = {};

    // Return the proper structure expected for the endpoint
    let endpoint = {
      capabilities: this.checkValue(opts.capabilities, []),
      description: this.checkValue(
        opts.description,
        "Sample Endpoint Description"
      ),
      displayCategories: this.checkValue(opts.displayCategories, ["OTHER"]),
      endpointId: this.checkValue(
        opts.endpointId,
        "endpoint_" + (Math.floor(Math.random() * 90000) + 10000)
      ),
      friendlyName: this.checkValue(opts.friendlyName, "Sample Endpoint"),
      manufacturerName: this.checkValue(
        opts.manufacturerName,
        "Sample Manufacturer"
      ),
    };

    if (opts.hasOwnProperty("additionalAttributes"))
      endpoint["additionalAttributes"] = this.checkValue(
        opts.additionalAttributes,
        {}
      );

    if (opts.hasOwnProperty("cookie"))
      endpoint["cookie"] = this.checkValue("cookie", {});

    return endpoint;
  }

  /**
   * Creates a capability for an endpoint within the payload.
   * @param opts Contains options for the endpoint capability.
   */
  createPayloadEndpointCapability(opts) {
    if (opts === undefined) opts = {};

    let capability = {};
    capability["type"] = this.checkValue(opts.type, "AlexaInterface");
    capability["interface"] = this.checkValue(opts.interface, "Alexa");
    capability["version"] = this.checkValue(opts.version, "3");

    let supported = this.checkValue(opts.supported, false);
    if (supported) {
      capability["properties"] = {};
      capability["properties"]["supported"] = supported;
      capability["properties"]["proactivelyReported"] = this.checkValue(
        opts.proactivelyReported,
        false
      );
      capability["properties"]["retrievable"] = this.checkValue(
        opts.retrievable,
        false
      );
    }

    let supportedIntents = this.checkValue(opts.supportedIntents, false);
    if (supportedIntents) {
      capability["configuration"] = {};
      capability["configuration"]["supportedIntents"] = supportedIntents;
    }

    return capability;
  }

  /**
   * Creates a capability for an blinds endpoint within the payload. The structure
   * of the blinds endpoint generated will mirror the public sample for a mode
   * controller based blinds endpoint.
   * https://developer.amazon.com/en-US/docs/alexa/smarthome/get-started-with-device-templates.html#blinds
   * @param opts Contains options for the endpoint capability.
   */
  createPayloadEndpointBlindsCapability(opts) {
    let capability = this.createPayloadEndpointCapability(opts);
    capability["instance"] = "Blinds.Position";

    let capabilityResources = {
      friendlyNames: [
        {
          "@type": "asset",
          value: {
            assetId: "Alexa.Setting.Opening",
          },
        },
      ],
    };
    capability["capabilityResources"] = capabilityResources;

    let blindsConfiguration = {
      ordered: false,
      supportedModes: [
        {
          value: "Position.Up",
          modeResources: {
            friendlyNames: [
              {
                "@type": "asset",
                value: {
                  assetId: "Alexa.Value.Open",
                },
              },
            ],
          },
        },
        {
          value: "Position.Down",
          modeResources: {
            friendlyNames: [
              {
                "@type": "asset",
                value: {
                  assetId: "Alexa.Value.Close",
                },
              },
            ],
          },
        },
      ],
    };
    capability["configuration"] = blindsConfiguration;

    let semantics = {
      actionMappings: [
        {
          "@type": "ActionsToDirective",
          actions: ["Alexa.Actions.Close", "Alexa.Actions.Lower"],
          directive: {
            name: "SetMode",
            payload: {
              mode: "Position.Down",
            },
          },
        },
        {
          "@type": "ActionsToDirective",
          actions: ["Alexa.Actions.Open", "Alexa.Actions.Raise"],
          directive: {
            name: "SetMode",
            payload: {
              mode: "Position.Up",
            },
          },
        },
      ],
      stateMappings: [
        {
          "@type": "StatesToValue",
          states: ["Alexa.States.Closed"],
          value: "Position.Down",
        },
        {
          "@type": "StatesToValue",
          states: ["Alexa.States.Open"],
          value: "Position.Up",
        },
      ],
    };
    capability["semantics"] = semantics;
    return capability;
  }

  /**
   * Creates a capability for a thermostats endpoint within the payload. The structure
   * of the thermostat endpoint generated will mirror the public sample for a single
   * setpoint thermostat endpoint.
   *https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-thermostatcontroller.html
   * @param opts Contains options for the endpoint capability.
   */
  createPayloadEndpointThermostatCapability(opts) {
    let capability = this.createPayloadEndpointCapability(opts);
    let thermostatConfiguration = {
      supportedModes: ["HEAT", "COOL", "AUTO", "ECO", "OFF"],
    };
    capability["configuration"] = thermostatConfiguration;
    return capability;
  }

  /**
   * Creates a capability for a temperature sensor within the payload. The structure
   * of generated will mirror the public sample for a single setpoint thermostat endpoint.
   *https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-thermostatcontroller.html
   * @param opts Contains options for the endpoint capability.
   */
  createPayloadEndpointTempSensorCapability(opts) {
    let capability = this.createPayloadEndpointCapability(opts);
    return capability;
  }

  /**
   * Get the composed Alexa Response.
   * @returns {AlexaResponse}
   */
  get() {
    return this;
  }
}

module.exports = AlexaResponse;

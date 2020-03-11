const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB();
const DYNAMO_CLIENT = require('aws-sdk/clients/dynamodb');
const documentClient = new DYNAMO_CLIENT.DocumentClient();
const Geocodio = require('geocodio-library-node');
const ddbGeo = require('dynamodb-geo');
const httpStatusCode = require('http-status-codes');
const short = require('short-uuid');
let response;

exports.lambdaHandler = async (event, context) => {
  const item = JSON.parse(event.body);
  if (!item.name || !item.address) {
    response = {
      statusCode: httpStatusCode.BAD_REQUEST,
      body: JSON.stringify({
        message: 'A name and address are required.'
      })
    };

    return response;
  }

  const geoData = await geocodeItem(item);
  if (geoData) {
    await saveGeolocationMetadata(geoData);
    response = {
      statusCode: httpStatusCode.CREATED,
      body: JSON.stringify({ id: geoData.RangeKeyValue.S })
    };
  }
  else {
    response = {
      statusCode: httpStatusCode.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({
        message: 'An error occurred trying to save the item'
      })
    };
  }

  return response;
};

/**
 * Attempt to geocode an item's address and add it to the database 
 * @param {any} item - Item details from the request body
 * @return {string} - Generated id for the item
 */
async function geocodeItem(item) {
  const coords = await geocodeAddress(item.address);
  if (!coords) {
    return;
  }

  try {
    const config =
      new ddbGeo.GeoDataManagerConfiguration(ddb, process.env.DynamoDBTableName);
    config.hashKeyLength = 5;

    const geoTableManager = new ddbGeo.GeoDataManager(config);

    const id = short.generate();
    const geoData = {
      RangeKeyValue: { S: id },
      GeoPoint: {
        latitude: coords.lat,
        longitude: coords.lng,
      },
      PutItemInput: {
        Item: {
          name: { S: item.name },
          address: { S: item.address },
        },
      },
    };

    await geoTableManager.putPoint(geoData).promise();

    return geoData;
  } catch (err) {
    console.log('An error occurred adding coordinates to Dynamo');
    console.log(err);
  }
}

/**
 * Uses Geocodio to geocode a specific address
 * @param {string} address - Address (line 1, line 2, city, state, zip) you want to geocode
 * @return {any} - Coordinates of the address passed in
 */
async function geocodeAddress(address) {
  let coords;
  try {
    const geocoder = new Geocodio(process.env.GeocodioApiKey);
    const response = await geocoder.geocode(address);

    if (response && response.results && response.results.length > 0) {
      // Results are returned with highest likelihood first, so grab the first one
      coords = response.results[0].location;
    }
  }
  catch (err) {
    console.log('An error occurred while geocoding the address: ' + address);
    console.log(err);
  }

  return coords;
}

/**
 * Save metadata about the item we are saving. Dynamodb-geo has a 
 * limitation with updating existing points. So we need to be able
 * to lookup the data for any PUTs
 * @param {any} geoData - All data passed into dynamodb-geo
 */
async function saveGeolocationMetadata(geoData) {
  try {
    let hash = Number(geoData.RangeKeyValue.S.replace(/\D/g, ''));
    const params = {
      TableName: process.env.DynamoDBTableName,
      Item: {
        hashKey: hash,
        rangeKey: geoData.RangeKeyValue.S,
        GeoPoint: geoData.GeoPoint
      }
    };

    await documentClient.put(params).promise();
  }
  catch (err) {
    console.log('An error occurred saving the geolocation metadata');
    console.log(err);
  }
}

/* eslint-disable object-curly-spacing */
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB();
const DYNAMO_CLIENT = require('aws-sdk/clients/dynamodb');
const documentClient = new DYNAMO_CLIENT.DocumentClient();
const httpStatusCode = require('http-status-codes');
const Geocodio = require('geocodio-library-node');
const ddbGeo = require('dynamodb-geo');

let response;

exports.lambdaHandler = async (event, context) => {
  try {
    const input = JSON.parse(event.body);
    if (!input.address || !input.name) {
      response = {
        statusCode: httpStatusCode.BAD_REQUEST,
        body: JSON.stringify({
          message: 'Name and address are required fields.'
        })
      };
      return response;
    }

    const item = await getItem(event.pathParameters.itemId);
    if (!item) {
      response = {
        statusCode: httpStatusCode.NOT_FOUND,
        body: JSON.stringify({
          message: `Item with id '${event.pathParameters.itemId}' could not be found`
        })
      };
      return response;
    }

    await deleteExistingItem(item);
    const geoPoint = await saveNewGeolocation(item.rangeKey, input);
    await saveGeoPointToItem(item, geoPoint);

    response = {
      statusCode: httpStatusCode.NO_CONTENT,
    };

  } catch (err) {
    console.log(err);
    response = {
      statusCode: httpStatusCode.INTERNAL_SERVER_ERROR,
      body: JSON.stringify(err),
    };
  }

  return response;
};



/**
 * @param {string} id - Id of the geolocated item
 */
async function getItem(id) {
  try {
    let hash = Number(id.replace(/\D/g, ''));
    const params = {
      TableName: process.env.DynamoDBTableName,
      Key: {
        hashKey: hash,
        rangeKey: id
      }
    };

    const result = await documentClient.get(params).promise();
    return result.Item;
  }
  catch (err) {
    console.log('An error occurred loading the item metadata');
    console.log(err);
  }
}

/**
 * Deletes the existing item using GeoDataManager
 * @param {any} item - Item details currently stored in Dynamo
 */
async function deleteExistingItem(item) {
  try {
    const config =
      new ddbGeo.GeoDataManagerConfiguration(ddb, process.env.DynamoDBTableName);
    config.hashKeyLength = 5;

    const geoTableManager = new ddbGeo.GeoDataManager(config);

    const oldGeoData = {
      RangeKeyValue: { S: item.rangeKey },
      GeoPoint: item.GeoPoint
    };

    await geoTableManager.deletePoint(oldGeoData).promise();
  } catch (err) {
    console.log('An error occurred deleting the item');
    console.log(err);
  }
}

/**
 * Updates the name in the database. Does not change address information
 * @param {string} id - Id of the item to update
 * @param {any} input - Input passed into the lambda function
 * @return {any} Recorded GeoPoint for future lookups
 */
async function saveNewGeolocation(id, input) {
  try {
    const coords = await geocodeAddress(input.address);
    if (!coords) {
      return;
    }

    const config = new ddbGeo.GeoDataManagerConfiguration(ddb, process.env.DynamoDBTableName);
    config.hashKeyLength = 5;

    const geoTableManager = new ddbGeo.GeoDataManager(config);
    const geoData = {
      RangeKeyValue: { S: id },
      GeoPoint: {
        latitude: coords.lat,
        longitude: coords.lng,
      },
      PutItemInput: {
        Item: {
          name: { S: input.name },
          address: { S: input.address },
        },
      },
    };

    await geoTableManager.putPoint(geoData).promise();

    return geoData.GeoPoint;
  } catch (err) {
    console.log('Unable to save geolocation for item');
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
 * Save metadata about the item for future lookups. This is to work around the 
 * limitation in dynamodb-geo that doesn't let you update addresses/geopoints
 * @param {any} item - Data about the geolocation to store for future lookup
 * @param {*} geoPoint - Geocoded coordinates for the passed in address
 */
async function saveGeoPointToItem(item, geoPoint) {
  item.GeoPoint = geoPoint;
  const params = {
    TableName: process.env.DynamoDBTableName,
    Item: item
  };

  await documentClient.put(params).promise();
}

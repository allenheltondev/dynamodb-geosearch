const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB();
const DYNAMO_CLIENT = require('aws-sdk/clients/dynamodb');
const documentClient = new DYNAMO_CLIENT.DocumentClient();
const ddbGeo = require('dynamodb-geo');
const httpStatusCode = require('http-status-codes');
let response;

exports.lambdaHandler = async (event, context) => {
  const id = event.pathParameters.itemId;

  const item = await getItem(id);
  if (!item) {
    response = {
      statusCode: httpStatusCode.NOT_FOUND,
      body: JSON.stringify({
        message: `An item with the id '${id}' could not be found`
      })
    };
  } else {
    await deleteExistingItem(item);
    await deleteExistingItemMetadata(id);

    response = {
      statusCode: httpStatusCode.NO_CONTENT
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
    console.log('An error occurred loading the geolocation metadata');
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
 * Delete the item metadata out of DynamoDB
 * @param {string} id - Identifier for the item metadata
 */
async function deleteExistingItemMetadata(id) {
  try {
    let hash = Number(id.replace(/\D/g, ''));
    const params = {
      TableName: process.env.DynamoDBTableName,
      Key: {
        hashKey: hash,
        rangeKey: id
      }
    };

    await documentClient.delete(params).promise();
  }
  catch (err) {
    console.log('An error occurred deleting item metadata');
    console.log(err);
  }
}


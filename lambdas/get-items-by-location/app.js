const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB();
const ddbGeo = require('dynamodb-geo');
const Geocodio = require('geocodio-library-node');
const httpStatusCode = require('http-status-codes');

const DefaultRadius = 5000;
let response;

exports.lambdaHandler = async (event, context) => {
  let coords;
  if (event.queryStringParameters.address) {
    const geoCoords = await geocodeAddress(event.queryStringParameters.address);
    coords = {
      latitude: geoCoords.lat,
      longitude: geoCoords.lng,
      radius: event.queryStringParameters.radius ? Number(event.queryStringParameters.radius) : DefaultRadius
    };
  }
  else {
    coords = parseCoordinates(event);
  }
  if (!coords) {
    response = {
      statusCode: httpStatusCode.BAD_REQUEST,
      body: JSON.stringify({
        message: 'Unable to parse the input coordinates and radius'
      })
    };
    return response;
  }

  const items = await runGeosearch(coords);
  const transformedItems = transformItems(items);
  response = {
    statusCode: httpStatusCode.OK,
    body: JSON.stringify(transformedItems),
  };


  return response;
};

/**
 * Search for items in Dynamo based on coordinates
 * @param {any} coords - Coordinates with radius for search
 * @return {Array} Found items based on coordinates
 */
async function runGeosearch(coords) {
  try {
    const config = new ddbGeo.GeoDataManagerConfiguration(ddb, process.env.DynamoDBTableName);
    config.hashKeyLength = 5;
    const geoTableManager = new ddbGeo.GeoDataManager(config);
    const query = {
      RadiusInMeter: coords.radius,
      CenterPoint: {
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    };
    const items = await geoTableManager.queryRadius(query);
    return items;
  }
  catch (err) {
    console.log('An error occurred while searching DynamoDB');
    console.log(err);
  }
}

function parseCoordinates(event) {
  if(!event.queryStringParameters.lat || !event.queryStringParameters.lng){
    return;
  }

  let coords;

  try {
    coords = {
      latitude: Number(event.queryStringParameters.lat),
      longitude: Number(event.queryStringParameters.lng),
      radius: event.queryStringParameters.radius ? Number(event.queryStringParameters.radius) : DefaultRadius
    };
  } catch (err) {
    console.log('The request did not have the correct query ' +
      'parameters or they were the wrong type');
  }

  return coords;
}

/**
 * Transform the raw item values to workable objects
 * @param {Array} items - Array of raw geo data for matching items
 * @return {Array} Transformed data transfer items
 */
function transformItems(items) {
  const transformedItems = [];
  if (items) {
    items.map(item => {
      try {
        const coords = JSON.parse(item.geoJson.S);
        const transformedItem = {
          id: item.rangeKey.S,
          name: item.name.S,
          address: item.address.S,
          coords: {
            lat: coords.coordinates[1],
            lng: coords.coordinates[0],
          },
        };

        transformedItems.push(transformedItem);
      } catch (err) { }
    });
  }

  return transformedItems;
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

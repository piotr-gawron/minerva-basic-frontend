let transformationData;

/**
 * Due to CORS we need to use proxy.
 * @param url
 * @return {Promise<Response>}
 */
async function fetchOverProxy(url) {
  return await fetch("https://minerva-dev.lcsb.uni.lu/minerva-proxy/?url=" + url.replace("&", "%26"));
}

/**
 * Computes some internal data used for transformation between x,y coordinates and lat,lon position.
 * @param options data obtained from minerva API for given submap
 * @return {{tileSize: number, zoomFactor: number, pixelsPerLonDegree: number, pixelsPerLonRadian: number}}
 */
function computeCoordinatesTransformationData(options) {
  return {
    tileSize: options.tileSize,
    pixelsPerLonDegree: options.tileSize / 360,
    pixelsPerLonRadian: options.tileSize / (2 * Math.PI),
    zoomFactor: Math.max(options.width, options.height) / (options.tileSize / (1 << options.minZoom))
  };
}

function radiansToDegrees(rad) {
  return rad / (Math.PI / 180);
}

function degreesToRadians(deg) {
  return deg * (Math.PI / 180);
}

/**
 *
 * @param {Object} point
 * @param {number} point.x
 * @param {number} point.y
 * @return {[number, number]}
 */
function pointToLonLat(point) {
  let x = point.x / transformationData.zoomFactor;
  let y = point.y / transformationData.zoomFactor;

  let lng = (x - transformationData.tileSize / 2) / transformationData.pixelsPerLonDegree;
  let latRadians = (y - transformationData.tileSize / 2) / -transformationData.pixelsPerLonRadian;
  let lat = radiansToDegrees(2 * Math.atan(Math.exp(latRadians)) - Math.PI / 2);
  return [lng, lat];
}

/**
 *
 * @param projection
 * @return {{x: number, y: number}}
 */
function fromProjectionToPoint(projection) {
  let lngLat = ol.proj.toLonLat(projection);
  let lat = lngLat[1];
  let lng = lngLat[0];

  let x = transformationData.tileSize / 2 + lng * transformationData.pixelsPerLonDegree;

  // Truncating to 0.9999 effectively limits latitude to 89.189. This is
  // about a third of a tile past the edge of the world tile.
  let sinusY = bound(Math.sin(degreesToRadians(lat)), -0.9999, 0.9999);
  let y = transformationData.tileSize / 2 + 0.5 * Math.log((1 + sinusY) / (1 - sinusY)) * -transformationData.pixelsPerLonRadian;

  // rescale the point (all computations are done assuming that we work on
  // TILE_SIZE square)
  x *= transformationData.zoomFactor;
  y *= transformationData.zoomFactor;
  return {x, y};
}

function bound(value, minVal, maxVal) {
  if (minVal !== null && minVal !== undefined) {
    value = Math.max(value, minVal);
  }
  if (maxVal !== null && maxVal !== undefined) {
    value = Math.min(value, maxVal);
  }
  return value;
}

/**
 *
 * @param elementId identifier of HTML tag where map wil be visualized
 * @param projectId identifier of the project
 * @param submapId identifier of the submap
 * @param serverUrl url to minerva location (for example https://pdmap.uni.lu/minerva/)
 */
async function createMap({elementId, projectId, submapId, serverUrl}) {
  let apiUrl = serverUrl + "api/";

  let response = await fetchOverProxy(apiUrl + "projects/" + projectId);
  let projectData = await response.json();

  let projectDirectory = serverUrl + "../map_images/" + projectData.directory;

  response = await fetchOverProxy(apiUrl + "projects/" + projectId + "/models/" + submapId);
  let submapData = await response.json();

  transformationData = computeCoordinatesTransformationData(submapData);

  let height = submapData.height;
  let width = submapData.width;
  let minZoom = submapData.minZoom;
  let maxZoom = submapData.maxZoom;

  response = await fetchOverProxy(apiUrl + "projects/" + projectId + "/overlays/");
  let overlaysData = await response.json();

  overlaysData = overlaysData.filter(function (el) {
    return el.name === "Network";
  });

  let imagesData = overlaysData[0].images.filter(function (el) {
    return el.modelId === submapId;
  });

  let overlayDirectory = projectDirectory + "/" + imagesData[0].path + "/";


  let map = new ol.Map({
    target: elementId,
    layers: [
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          minZoom: minZoom,
          maxZoom: maxZoom,
          wrapX: false,
          tileLoadFunction: function (imageTile, src) {
            if (src !== null) {
              // noinspection JSUnresolvedFunction
              imageTile.getImage().src = src;
            }
          },
          tileUrlFunction: function (coordinate) {
            let zoom = coordinate[0];
            // we have 1 tile on MIN_ZOOM and therefore must limit tails according to this
            let maxTileRange = 1 << (zoom - minZoom);
            let maxTileXRange = maxTileRange;
            let maxTileYRange = maxTileRange;

            let x = coordinate[1];
            let y = coordinate[2];

            if (width > height) {
              maxTileYRange = height / width * maxTileRange;
            } else if (width < height) {
              maxTileXRange = width / height * maxTileRange;
            }
            if (y < 0 || y >= maxTileYRange || x < 0 || x >= maxTileXRange) {
              return null;
            }

            return overlayDirectory + zoom + "/" + x + "/" + y + ".PNG";
          }
        })
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat(pointToLonLat({x: width / 2, y: height / 2})),
      zoom: 4
    })
  });

  map.on("click", async function (evt) {
    let point = fromProjectionToPoint(evt.coordinate);
    console.log("Click on point: ", point);
    let response = await fetchOverProxy(apiUrl + "projects/" + projectId + "/models/" + submapId + "/bioEntities:search?coordinates=" + point.x + "," + point.y + "&count=1");
    let data = await response.json();
    let result = null;
    if (data.length > 0) {
      if (data[0].type === "ALIAS") {
        response = await fetchOverProxy(apiUrl + "projects/" + projectId + "/models/" + submapId + "/bioEntities/elements/?id=" + data[0].id);
        data = await response.json();
        alert("You clicked on element " + data[0].type + ": " + data[0].name);
      } else if (data[0].type === "REACTION") {
        response = await fetchOverProxy(apiUrl + "projects/" + projectId + "/models/" + submapId + "/bioEntities/reactions/?id=" + data[0].id);
        data = await response.json();
        alert("You clicked on reaction " + data[0].type + ": " + data[0].reactionId);
      }
    }
  });

  return map;
}
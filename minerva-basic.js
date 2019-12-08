/**
 * Due to CORS we need to use proxy.
 * @param url
 * @return {Promise<Response>}
 */
async function fetchOverProxy(url) {
  return await fetch("https://minerva-dev.lcsb.uni.lu/minerva-proxy/?url=" + url);
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


  return new ol.Map({
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
      center: ol.proj.fromLonLat([-120, 90]), //TODO this should be automatically centered
      zoom: 4
    })
  });
}
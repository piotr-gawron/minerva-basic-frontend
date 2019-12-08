/**
 *
 * @param {Object} params
 * @param {String} params.elementId identifier of HTML tag where map wil be visualized
 * @return {Map}
 */
function createMap(params) {
  return new ol.Map({
    target: params.elementId,
    layers: [
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          minZoom: 2, //TODO
          maxZoom: 9, //TODO
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
            let maxTileRange = 1 << (zoom - 2); //TODO minZoom
            let maxTileXRange = maxTileRange;
            let maxTileYRange = maxTileRange;

            let x = coordinate[1];
            let y = coordinate[2];

            let width = 28045; //TODO
            let height = 13644; //TODO
            if (width > height) {
              maxTileYRange = height / width * maxTileRange;
            } else if (width < height) {
              maxTileXRange = width / height * maxTileRange;
            }
            if (y < 0 || y >= maxTileYRange || x < 0 || x >= maxTileXRange) {
              return null;
            }

            return "https://pdmap.uni.lu/map_images/1cc799ade846d30a2e742089e72e2484/_normal0/" + zoom + "/" + x + "/" + y + ".PNG"; //TODO
          }
        })
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([-120, 90]),//TODO
      zoom: 4
    })
  });
}
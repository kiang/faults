window.app = {};
var app = window.app;

app.Button = function(opt_options) {
  var options = opt_options || {};
  var button = document.createElement('button');
  button.innerHTML = options.bText;
  var this_ = this;
  var handleButtonClick = function() {
    window.open(options.bHref);
  };

  button.addEventListener('click', handleButtonClick, false);
  button.addEventListener('touchstart', handleButtonClick, false);

  var element = document.createElement('div');
  element.className = options.bClassName + ' ol-unselectable ol-control';
  element.appendChild(button);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(app.Button, ol.control.Control);

var projection = ol.proj.get('EPSG:3857');
var projectionExtent = projection.getExtent();
var size = ol.extent.getWidth(projectionExtent) / 256;
var resolutions = new Array(20);
var matrixIds = new Array(20);
var clickedCoordinate, populationLayer, gPopulation;
for (var z = 0; z < 20; ++z) {
    // generate resolutions and matrixIds arrays for this WMTS
    resolutions[z] = size / Math.pow(2, z);
    matrixIds[z] = z;
}
var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var closer = document.getElementById('popup-closer');
var popup = new ol.Overlay({
  element: container,
  autoPan: true,
  autoPanAnimation: {
    duration: 250
  }
});

var layerYellow = new ol.style.Style({
  stroke: new ol.style.Stroke({
      color: 'rgba(0,0,0,1)',
      width: 1
  }),
  fill: new ol.style.Fill({
      color: 'rgba(255,255,0,0.3)'
  }),
  text: new ol.style.Text({
    font: 'bold 16px "Open Sans", "Arial Unicode MS", "sans-serif"',
    placement: 'point',
    fill: new ol.style.Fill({
      color: 'blue'
    })
  })
});

closer.onclick = function() {
  popup.setPosition(undefined);
  closer.blur();
  return false;
};

var baseLayer = new ol.layer.Tile({
    source: new ol.source.WMTS({
        matrixSet: 'EPSG:3857',
        format: 'image/png',
        url: 'http://wmts.nlsc.gov.tw/wmts',
        layer: 'EMAP',
        tileGrid: new ol.tilegrid.WMTS({
            origin: ol.extent.getTopLeft(projectionExtent),
            resolutions: resolutions,
            matrixIds: matrixIds
        }),
        style: 'default',
        wrapX: true,
        attributions: '<a href="http://maps.nlsc.gov.tw/" target="_blank">國土測繪圖資服務雲</a>'
    }),
    opacity: 0.3
});

var faultStyle = function(f) {
  var rate = f.get('RupturePro').replace('<', '').split(/(：|%)/)[2];
  if(rate > 20) {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: '#FF0000',
        width: 10
      })
    })
  } else {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: '#000000',
        width: 10
      })
    })
  }
}

// or official from https://data.gov.tw/dataset/35587
var faults = new ol.layer.Vector({
    source: new ol.source.Vector({
        url: 'twreporter.xml', // downloaded from https://www.twreporter.org/a/dangerous-fault-architect
        format: new ol.format.KML({
          extractStyles: false
        })
    }),
    style: faultStyle
});

var appView = new ol.View({
  center: ol.proj.fromLonLat([120.301507, 23.124694]),
  zoom: 10
});

var map = new ol.Map({
  layers: [baseLayer, faults],
  overlays: [popup],
  target: 'map',
  view: appView,
  controls: ol.control.defaults().extend([
    new app.Button({
      bClassName: 'app-button1',
      bText: '原',
      bHref: 'https://github.com/kiang/faults'
    }),
    new app.Button({
      bClassName: 'app-button2',
      bText: '報',
      bHref: 'https://www.twreporter.org/a/dangerous-fault-architect'
    }),
    new app.Button({
      bClassName: 'app-button3',
      bText: '江',
      bHref: 'https://www.facebook.com/k.olc.tw/'
    })
  ])
});

var geolocation = new ol.Geolocation({
  projection: appView.getProjection()
});

geolocation.setTracking(true);

geolocation.on('error', function(error) {
        console.log(error.message);
      });

var positionFeature = new ol.Feature();

positionFeature.setStyle(new ol.style.Style({
  image: new ol.style.Circle({
    radius: 6,
    fill: new ol.style.Fill({
      color: '#3399CC'
    }),
    stroke: new ol.style.Stroke({
      color: '#fff',
      width: 2
    })
  })
}));

geolocation.on('change:position', function() {
  var coordinates = geolocation.getPosition();
  positionFeature.setGeometry(coordinates ?
          new ol.geom.Point(coordinates) : null);
      });

      new ol.layer.Vector({
        map: map,
        source: new ol.source.Vector({
          features: [positionFeature]
        })
      });
/**
 * Add a click handler to the map to render the popup.
 */
map.on('singleclick', function(evt) {
  clickedCoordinate = evt.coordinate;
  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
      var p = feature.getProperties();
      if(p['Mw']) {
        $.getJSON('faults/' + p['name'] + '.json', function(j) {
          if(populationLayer) {
            map.removeLayer(populationLayer);
          }
          gPopulation = j.basecodes;
          populationLayer = new ol.layer.Vector({
              source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                features: new ol.format.GeoJSON().readFeatures( j.fc, {
                  featureProjection: 'EPSG:3857'
                })
              }),
              style: function(f) {
                layerYellow.getText().setText(gPopulation[f.get('CODEBASE')].toString());
                return layerYellow;
              }
          });
          map.addLayer(populationLayer);
          map.getView().fit(populationLayer.getSource().getExtent());

          var message = '';
          message += '斷層名稱：' + j['properties']['name'] + '<br />';
          message += j['properties']['RupturePro'] + '<br />';
          message += j['properties']['Mw'] + '<br />';
          message += '人口： ' + j['basecodes']['total'] + '<br />';
          if(message !== '') {
            content.innerHTML = message;
            popup.setPosition(clickedCoordinate);
          } else {
            popup.setPosition(undefined);
            closer.blur();
          }
        })
      }
  });
});

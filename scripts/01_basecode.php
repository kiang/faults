<?php
require 'vendor/autoload.php';

$population = array();
foreach(glob('/home/kiang/public_html/tw_population/basecode/*.json') AS $jsonFile) {
  $json = json_decode(file_get_contents($jsonFile), true);
  foreach($json['RowDataList'] AS $c) {
    $population[$c['CODEBASE']] = $c['P_CNT'];
  }
}

$basecodes = array();
foreach(glob('/home/kiang/public_html/taiwan_basecode/base/geo/*/*.json') AS $jsonFile) {
  $json = json_decode(file_get_contents($jsonFile), true);
  foreach($json['features'] AS $f) {
    $basecodes[$f['properties']['CODEBASE']] = array(
      'properties' => $f['properties'],
      'geometry' => geoPHP::load(json_encode($f['geometry']), 'json'),
    );
  }
}

$xml = file_get_contents(dirname(__DIR__) . '/twreporter.xml');
$placemarks = explode('</Placemark>', $xml);
foreach($placemarks AS $placemark) {
  $parts = explode('<Placemark>', $placemark);
  if(isset($parts[1])) {
    $part = '<Placemark>' . $parts[1] . '</Placemark>';
    $xmlObj = simplexml_load_string($part);
    $name = trim((string)$xmlObj->name);
    if(!empty($name)) {
      if(!isset($pool[$name])) {
        $pool[$name] = array(
          'properties' => array(),
          'geometries' => array(),
          'basecodes' => array(
            'total' => 0,
          ),
          'fc' => array(
            'type' => 'FeatureCollection',
            'features' => array(),
          ),
        );
      }
      foreach($xmlObj->ExtendedData->Data AS $obj) {
        foreach($obj->attributes() AS $a) {
          if(!empty($obj->value)) {
            $pool[$name]['properties'][(string)$a] = (string)$obj->value;
          }
        }
      }
      $pool[$name]['geometries'][] = geoPHP::load($part, 'kml');
    }
  }
}

foreach($pool AS $name => $data) {
  error_log("processing {$name}");
  foreach($data['geometries'] AS $k => $faultGeometry) {
    foreach($basecodes AS $basecode => $baseData) {
      if($faultGeometry->intersects($baseData['geometry'])) {
        if(isset($population[$basecode])) {
          $pool[$name]['basecodes'][$basecode] = $population[$basecode];
          $pool[$name]['basecodes']['total'] += $population[$basecode];
        } else {
          $pool[$name]['basecodes'][$basecode] = 0;
        }
        $pool[$name]['fc']['features'][] = array(
          'type' => 'Feature',
          'properties' => $baseData['properties'],
          'geometry' => json_decode($baseData['geometry']->out('json'), true),
        );
      }
    }
  }
  unset($pool[$name]['geometries']);
  file_put_contents(dirname(__DIR__) . '/faults/' . $name . '.json', json_encode($pool[$name]));
}

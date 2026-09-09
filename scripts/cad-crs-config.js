export const CAD_SOURCE_CRS = {
  authority: 'EPSG',
  code: 9210,
  id: 'EPSG:9210',
  name: 'VN-2000 / TM-3 105-45',
  unit: 'metre',
  axisOrder: ['easting', 'northing'],
  centralMeridian: 105.75,
  scaleFactor: 0.9999,
  falseEasting: 500000,
  falseNorthing: 0,
  proj4:
    '+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs +type=crs',
}

export const CAD_TARGET_CRS = {
  authority: 'EPSG',
  code: 4326,
  id: 'EPSG:4326',
  name: 'WGS 84',
  unit: 'degree',
  axisOrderForGeoJson: ['longitude', 'latitude'],
}

// Text insertion points are not survey monuments. These anchors identify the
// CRS by checking that independent CAD place labels land in the corresponding
// real-world locality. The deliberately broad tolerances account for label
// offsets and must not be reused as an asset-accuracy acceptance threshold.
export const CRS_VERIFICATION_ANCHORS = [
  {
    id: 'hau-nghia',
    label: 'Hậu Nghĩa',
    sourceFile: 'kenh_thuy_loi_01.geojson',
    rawCoordinate: [569367.108, 1205504.175],
    referenceCoordinate: [106.3930829, 10.8947791],
    referenceDescription: 'OSM/Nominatim administrative locality centroid: Xã Hậu Nghĩa',
    maximumDistanceMetres: 1500,
  },
  {
    id: 'duc-hoa',
    label: 'Đức Hòa',
    sourceFile: 'kenh_thuy_loi_01.geojson',
    rawCoordinate: [576297.024, 1196877.162],
    referenceCoordinate: [106.4567714, 10.8226052],
    referenceDescription: 'OSM/Nominatim administrative locality centroid: Xã Đức Hòa',
    maximumDistanceMetres: 1500,
  },
  {
    id: 'hiep-hoa',
    label: 'Hiệp Hòa',
    sourceFile: 'kenh_thuy_loi_01.geojson',
    rawCoordinate: [561442.232, 1207138.905],
    referenceCoordinate: [106.3171018, 10.9149494],
    referenceDescription: 'OSM/Nominatim town point: Hiệp Hòa',
    maximumDistanceMetres: 1500,
  },
  {
    id: 'my-hanh',
    label: 'Mỹ Hạnh',
    sourceFile: 'cad_points.geojson',
    rawCoordinate: [579209.802, 1203399.761],
    referenceCoordinate: [106.466622, 10.8827064],
    referenceDescription: 'OSM/Nominatim named road point: Mỹ Hạnh',
    maximumDistanceMetres: 1500,
  },
]

export const CAD_CRS_EVIDENCE = {
  status: 'identified_by_spatial_crosscheck',
  identifiedAt: '2026-09-09',
  modelSpaceCrs: CAD_SOURCE_CRS.id,
  paperSpaceCrs: null,
  targetWebCrs: CAD_TARGET_CRS.id,
  verificationMethod: 'Four independent named CAD anchors transformed and matched to real-world localities',
  officialOperationAccuracyMetres: 1,
  surveyCertified: false,
  warning:
    'CRS identity is strongly supported for model-space data. Individual asset positions still require survey/control-point QA before field-grade use.',
}

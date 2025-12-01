#!/usr/bin/env node

/**
 * Update Script for Espoo Buildings Data
 *
 * This script fetches ALL buildings in Espoo using BBOX chunking
 * to avoid WFS service limitations and saves them as a static GeoJSON file.
 *
 * Usage: node update-buildings.js
 */

const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const proj4 = require('proj4');
const xml2js = require('xml2js');
const ora = require('ora');
const chalk = require('chalk');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
    wfs: {
        endpoint: 'https://kartat.espoo.fi/teklaogcweb/wfs.ashx',
        typename: 'GIS:Rakennukset',
        version: '1.1.0',
        srsName: 'EPSG:3879'
    },
    // Espoo boundaries in EPSG:3879 (Finnish ETRS-GK25)
    espoo: {
        minEast: 374000,
        maxEast: 395000,
        minNorth: 6657000,
        maxNorth: 6690000
    },
    // Chunk size in meters (5km x 5km squares)
    chunkSize: 5000,
    // Output file
    outputFile: path.join(__dirname, 'data', 'espoo-buildings.json')
};

// Finnish ETRS-GK25 projection definition
proj4.defs('EPSG:3879', '+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');

// Building type mappings (same as in the web app)
const BUILDING_TYPES = {
    '011': { fi: 'Omakotitalo', en: 'Detached house', category: 'omakotitalo' },
    '012': { fi: 'Paritalo', en: 'Semi-detached house', category: 'paritalo' },
    '013': { fi: 'Rivitalo', en: 'Row house', category: 'rivitalo' },
    '021': { fi: 'Kerrostalo', en: 'Apartment building', category: 'kerrostalo' },
    '022': { fi: 'Luhtitalo', en: 'Gallery access building', category: 'kerrostalo' },
    '032': { fi: 'Asuntola', en: 'Dormitory', category: 'kerrostalo' },
    '041': { fi: 'Toimistorakennus', en: 'Office building', category: 'muu' },
    '111': { fi: 'Myymälä', en: 'Shop', category: 'muu' },
    '121': { fi: 'Hotelli', en: 'Hotel', category: 'muu' },
    '511': { fi: 'Koulu', en: 'School', category: 'muu' },
    '611': { fi: 'Sairaala', en: 'Hospital', category: 'muu' },
    'default': { fi: 'Muu rakennus', en: 'Other building', category: 'muu' }
};

/**
 * Build WFS request URL
 */
function buildWFSUrl(maxFeatures = 100000) {
    const params = new URLSearchParams({
        service: 'WFS',
        version: CONFIG.wfs.version,
        request: 'GetFeature',
        typename: CONFIG.wfs.typename,
        srsName: CONFIG.wfs.srsName,
        maxFeatures: maxFeatures
    });

    return `${CONFIG.wfs.endpoint}?${params.toString()}`;
}

/**
 * Parse XML response to extract features
 */
async function parseXMLResponse(xmlText) {
    const parser = new xml2js.Parser({
        ignoreAttrs: false,
        explicitArray: false,
        tagNameProcessors: [xml2js.processors.stripPrefix]
    });

    const result = await parser.parseStringPromise(xmlText);
    const features = [];

    // Navigate to feature members
    let members = [];
    if (result.FeatureCollection && result.FeatureCollection.featureMember) {
        members = Array.isArray(result.FeatureCollection.featureMember)
            ? result.FeatureCollection.featureMember
            : [result.FeatureCollection.featureMember];
    }

    // Process each member
    for (const member of members) {
        try {
            const feature = processFeatureMember(member);
            if (feature) {
                features.push(feature);
            }
        } catch (error) {
            console.warn('Error processing feature:', error.message);
        }
    }

    return features;
}

/**
 * Process individual feature member from XML
 */
function processFeatureMember(member) {
    if (!member.Rakennukset) return null;

    const building = member.Rakennukset;

    // Extract properties
    const properties = {
        VALMISTUNUT: building.VALMISTUNUT || building.VALMISTUNUTYYYYMMDD || null,
        KAYTTOTARKOITUS: building.KAYTTOTARKOITUS || null,
        KERROSLUKU: building.KERROSLUKU || null,
        KERROSALA: building.KERROSALA || null,
        KOKONAISALA: building.KOKONAISALA || null,
        TILAVUUS: building.TILAVUUS || null,
        OSOITE: building.OSOITE || building.KATUOSOITE || null,
        POSTINUMERO: building.POSTINUMERO || null,
        KIINTEISTOTUNNUS: building.KIINTEISTOTUNNUS || null,
        RAKENNUSTUNNUS: building.RAKENNUSTUNNUS || null
    };

    // Extract geometry
    let geometry = null;
    if (building.Geometry) {
        geometry = extractGeometry(building.Geometry);
    }

    if (!geometry) return null;

    return {
        type: 'Feature',
        properties,
        geometry
    };
}

/**
 * Extract geometry from XML structure
 */
function extractGeometry(geomNode) {
    // Handle Polygon
    if (geomNode.Polygon) {
        const coordinates = extractPolygonCoordinates(geomNode.Polygon);
        if (coordinates) {
            return {
                type: 'Polygon',
                coordinates
            };
        }
    }

    // Handle MultiPolygon
    if (geomNode.MultiPolygon) {
        const polygons = [];
        const members = Array.isArray(geomNode.MultiPolygon.polygonMember)
            ? geomNode.MultiPolygon.polygonMember
            : [geomNode.MultiPolygon.polygonMember];

        for (const member of members) {
            if (member.Polygon) {
                const coords = extractPolygonCoordinates(member.Polygon);
                if (coords) {
                    polygons.push(coords);
                }
            }
        }

        if (polygons.length > 0) {
            return {
                type: 'MultiPolygon',
                coordinates: polygons
            };
        }
    }

    // Handle Point
    if (geomNode.Point) {
        const coords = extractPointCoordinates(geomNode.Point);
        if (coords) {
            return {
                type: 'Point',
                coordinates: coords
            };
        }
    }

    return null;
}

/**
 * Extract polygon coordinates from XML
 */
function extractPolygonCoordinates(polygon) {
    const rings = [];

    // Exterior ring
    if (polygon.exterior && polygon.exterior.LinearRing) {
        const exterior = extractLinearRingCoordinates(polygon.exterior.LinearRing);
        if (exterior) rings.push(exterior);
    }

    // Interior rings (holes)
    if (polygon.interior) {
        const interiors = Array.isArray(polygon.interior) ? polygon.interior : [polygon.interior];
        for (const interior of interiors) {
            if (interior.LinearRing) {
                const ring = extractLinearRingCoordinates(interior.LinearRing);
                if (ring) rings.push(ring);
            }
        }
    }

    return rings.length > 0 ? rings : null;
}

/**
 * Extract LinearRing coordinates
 */
function extractLinearRingCoordinates(linearRing) {
    const coords = [];

    // Try posList first
    if (linearRing.posList) {
        const values = linearRing.posList.split(/\s+/).map(Number);
        for (let i = 0; i < values.length; i += 2) {
            if (i + 1 < values.length) {
                coords.push([values[i], values[i + 1]]);
            }
        }
    }
    // Try individual pos elements
    else if (linearRing.pos) {
        const positions = Array.isArray(linearRing.pos) ? linearRing.pos : [linearRing.pos];
        for (const pos of positions) {
            const values = pos.split(/\s+/).map(Number);
            if (values.length >= 2) {
                coords.push([values[0], values[1]]);
            }
        }
    }

    return coords.length > 0 ? coords : null;
}

/**
 * Extract Point coordinates
 */
function extractPointCoordinates(point) {
    if (point.pos) {
        const values = point.pos.split(/\s+/).map(Number);
        if (values.length >= 2) {
            return [values[0], values[1]];
        }
    }
    return null;
}

/**
 * Transform coordinates from EPSG:3879 to WGS84
 */
function transformCoordinates(coords) {
    return proj4('EPSG:3879', 'WGS84', coords);
}

/**
 * Transform geometry coordinates recursively
 */
function transformGeometry(geometry) {
    if (!geometry || !geometry.coordinates) return geometry;

    function transformRecursive(coords) {
        if (typeof coords[0] === 'number') {
            return transformCoordinates(coords);
        } else {
            return coords.map(c => transformRecursive(c));
        }
    }

    return {
        ...geometry,
        coordinates: transformRecursive(geometry.coordinates)
    };
}

/**
 * Get polygon center point
 */
function getPolygonCenter(coordinates) {
    if (!coordinates || !coordinates[0]) return null;

    const ring = coordinates[0];
    let totalX = 0;
    let totalY = 0;
    let count = 0;

    for (let i = 0; i < ring.length - 1; i++) {
        totalX += ring[i][0];
        totalY += ring[i][1];
        count++;
    }

    return count > 0 ? [totalX / count, totalY / count] : null;
}

/**
 * Parse year from date string
 */
function parseYear(dateString) {
    if (!dateString) return null;

    // Format: YYYYMMDD
    if (/^\d{8}$/.test(dateString)) {
        return parseInt(dateString.substring(0, 4));
    }

    // Format: YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(dateString)) {
        return parseInt(dateString.substring(0, 4));
    }

    // Format: just YYYY
    if (/^\d{4}$/.test(dateString)) {
        return parseInt(dateString);
    }

    // Try to extract any 4-digit year
    const yearMatch = dateString.match(/\d{4}/);
    if (yearMatch) {
        return parseInt(yearMatch[0]);
    }

    return null;
}

/**
 * Get building category from type code
 */
function getBuildingCategory(typeCode) {
    if (!typeCode) return 'muu';

    // First try numeric code
    const typeStr = typeCode.toString().padStart(3, '0');
    const typeInfo = BUILDING_TYPES[typeStr];
    if (typeInfo) return typeInfo.category;

    // Then try text-based matching
    const typeText = typeCode.toString().toLowerCase();

    if (typeText.includes('kerrostalo') || typeText.includes('asuinkerrostalo')) {
        return 'kerrostalo';
    } else if (typeText.includes('omakotitalo') || typeText.includes('yhden asunnon')) {
        return 'omakotitalo';
    } else if (typeText.includes('rivitalo') || typeText.includes('kytketty')) {
        return 'rivitalo';
    } else if (typeText.includes('paritalo') || typeText.includes('kahden asunnon')) {
        return 'paritalo';
    }

    return 'muu';
}

/**
 * Process features to GeoJSON format
 */
function processFeaturesToGeoJSON(allFeatures) {
    const processedFeatures = [];
    const stats = {
        total: 0,
        byType: {},
        byDecade: {},
        missingYear: 0,
        missingType: 0,
        totalFloorArea: 0
    };

    for (const feature of allFeatures) {
        try {
            // Transform geometry
            const transformedGeometry = transformGeometry(feature.geometry);

            // Get center point for heatmap
            let centerPoint;
            if (transformedGeometry.type === 'Point') {
                centerPoint = transformedGeometry.coordinates;
            } else if (transformedGeometry.type === 'Polygon') {
                centerPoint = getPolygonCenter(transformedGeometry.coordinates);
            } else if (transformedGeometry.type === 'MultiPolygon') {
                centerPoint = getPolygonCenter(transformedGeometry.coordinates[0]);
            }

            if (!centerPoint) continue;

            // Extract properties
            const props = feature.properties || {};

            // Parse year
            const year = parseYear(props.VALMISTUNUT);
            if (!year || year < 1800 || year > new Date().getFullYear() + 1) {
                stats.missingYear++;
            }

            // Get building type
            const buildingType = getBuildingCategory(props.KAYTTOTARKOITUS);
            if (!props.KAYTTOTARKOITUS) {
                stats.missingType++;
            }

            // Create processed feature
            const processedFeature = {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: centerPoint
                },
                properties: {
                    year: year,
                    type: buildingType,
                    typeCode: props.KAYTTOTARKOITUS,
                    floors: parseInt(props.KERROSLUKU) || null,
                    floorArea: parseFloat(props.KERROSALA) || null,
                    totalArea: parseFloat(props.KOKONAISALA) || null,
                    volume: parseFloat(props.TILAVUUS) || null,
                    address: props.OSOITE || '',
                    postalCode: props.POSTINUMERO || ''
                }
            };

            processedFeatures.push(processedFeature);

            // Update statistics
            stats.total++;
            stats.byType[buildingType] = (stats.byType[buildingType] || 0) + 1;

            if (year) {
                const decade = Math.floor(year / 10) * 10;
                stats.byDecade[decade] = (stats.byDecade[decade] || 0) + 1;
            }

            if (props.KERROSALA) {
                stats.totalFloorArea += parseFloat(props.KERROSALA);
            }

        } catch (error) {
            console.warn('Error processing feature:', error.message);
        }
    }

    return {
        type: 'FeatureCollection',
        features: processedFeatures,
        metadata: {
            generatedAt: new Date().toISOString(),
            totalBuildings: stats.total,
            statistics: stats
        }
    };
}

/**
 * Fetch all buildings from WFS
 */
async function fetchAllBuildings() {
    // Try to fetch all buildings with a high limit
    const url = buildWFSUrl(100000);

    try {
        console.log(`Fetching from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();

        // Check if we got XML response
        if (!xmlText.includes('<?xml')) {
            throw new Error('Invalid response format - not XML');
        }

        const features = await parseXMLResponse(xmlText);

        return features;
    } catch (error) {
        console.error(`\nError fetching buildings:`, error.message);
        throw error;
    }
}

/**
 * Main function to update building data
 */
async function updateBuildingData() {
    console.log(chalk.blue('\n=== Espoo Buildings Data Updater ===\n'));

    console.log(chalk.cyan(`📍 Fetching all Espoo buildings from WFS service...\n`));

    // Create progress spinner
    const spinner = ora('Fetching building data from WFS...').start();

    try {
        // Fetch all buildings in one request
        const allFeatures = await fetchAllBuildings();

        spinner.succeed(`Successfully fetched ${allFeatures.length} buildings`);

        console.log(chalk.green(`✅ Total raw features fetched: ${allFeatures.length}`));

        // Process features
        console.log(chalk.cyan('\n⚙️  Processing features...'));
        const geoJSON = processFeaturesToGeoJSON(allFeatures);

        // Display statistics
        console.log(chalk.blue('\n📊 Statistics:'));
        console.log(`   Total buildings: ${chalk.yellow(geoJSON.metadata.totalBuildings)}`);
        console.log(`   Missing year data: ${chalk.yellow(geoJSON.metadata.statistics.missingYear)}`);
        console.log(`   Missing type data: ${chalk.yellow(geoJSON.metadata.statistics.missingType)}`);
        console.log(`   Total floor area: ${chalk.yellow(Math.round(geoJSON.metadata.statistics.totalFloorArea).toLocaleString())} m²`);

        console.log(chalk.blue('\n   By type:'));
        for (const [type, count] of Object.entries(geoJSON.metadata.statistics.byType)) {
            console.log(`   - ${type}: ${chalk.yellow(count)}`);
        }

        // Save to file
        console.log(chalk.cyan('\n💾 Saving data...'));
        await fs.ensureDir(path.dirname(CONFIG.outputFile));
        await fs.writeJson(CONFIG.outputFile, geoJSON, { spaces: 2 });

        const fileSize = (await fs.stat(CONFIG.outputFile)).size;
        console.log(chalk.green(`✅ Data saved to: ${CONFIG.outputFile}`));
        console.log(chalk.green(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`));

        // Generate MVT tiles
        console.log(chalk.cyan('\n🗺️  Generating MVT tiles...'));
        try {
            const tileScript = path.join(__dirname, 'generate-mvt-tiles.sh');

            // Check if script exists
            if (await fs.pathExists(tileScript)) {
                console.log(chalk.blue('   Running: ./generate-mvt-tiles.sh'));

                // Execute tile generation script
                execSync(`bash "${tileScript}"`, {
                    stdio: 'inherit',
                    cwd: __dirname
                });

                console.log(chalk.green('\n✅ MVT tiles generated successfully!'));
            } else {
                console.log(chalk.yellow('   ⚠️  Tile generation script not found, skipping...'));
                console.log(chalk.yellow(`   Run './generate-mvt-tiles.sh' manually to generate tiles.`));
            }
        } catch (tileError) {
            console.log(chalk.yellow('\n⚠️  Tile generation failed (non-critical):'));
            console.log(chalk.yellow(`   ${tileError.message}`));
            console.log(chalk.yellow('   You can run ./generate-mvt-tiles.sh manually later.'));
        }

        console.log(chalk.blue('\n✨ Update completed successfully!\n'));
    } catch (error) {
        spinner.fail('Failed to fetch building data');
        throw error;
    }
}

// Run the update
updateBuildingData().catch(error => {
    console.error(chalk.red('\n❌ Update failed:'), error);
    process.exit(1);
});
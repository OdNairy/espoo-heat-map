// XML Parser for WFS responses

window.xmlParser = {
    /**
     * Parse WFS XML response to GeoJSON
     */
    parseWFSResponse: function(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML parsing failed: ' + parserError.textContent);
        }

        // Find all feature members - try with different namespace variations
        const features = [];
        let members = xmlDoc.querySelectorAll('gml\\:featureMember, featureMember');
        if (members.length === 0) {
            // Try without namespace
            members = xmlDoc.getElementsByTagName('featureMember');
        }
        if (members.length === 0) {
            // Try with gml namespace
            members = xmlDoc.getElementsByTagNameNS('http://www.opengis.net/gml', 'featureMember');
        }

        members.forEach(member => {
            const feature = this.parseFeature(member);
            if (feature) {
                features.push(feature);
            }
        });

        return {
            type: 'FeatureCollection',
            features: features
        };
    },

    /**
     * Parse individual feature from XML
     */
    parseFeature: function(memberNode) {
        try {
            // Get the actual feature element (child of member)
            const featureNode = memberNode.firstElementChild;
            if (!featureNode) return null;

            // Extract properties
            const properties = this.extractProperties(featureNode);

            // Extract geometry
            const geometry = this.extractGeometry(featureNode);

            if (!geometry) return null;

            return {
                type: 'Feature',
                properties: properties,
                geometry: geometry
            };
        } catch (error) {
            console.error('Error parsing feature:', error);
            return null;
        }
    },

    /**
     * Extract properties from feature node
     */
    extractProperties: function(featureNode) {
        const properties = {};

        // Common property names in Finnish WFS services (as seen in actual data)
        const propertyNames = [
            'VALMISTUNUT', 'VALMISTUNUTYYYYMMDD', 'VALMISTUNUTXML',
            'KAYTTOTARKOITUS', 'RAKENNUSTYYPPI',
            'KERROSLUKU', 'KERROSALA', 'KOKONAISALA', 'TILAVUUS',
            'OSOITE', 'KATUOSOITE', 'POSTINUMERO',
            'KIINTEISTOTUNNUS', 'RAKENNUSTUNNUS', 'PYSYVARAKENNUSTUNNUS',
            'KANTAVARAKENNE', 'POLTTOAINE', 'LAMMITYSTAPA',
            'HUONEISTOT', 'KELLARINPINTAALA', 'KAYTETTYRAKENNUSOIKEUS'
        ];

        // Try different namespace prefixes
        const prefixes = ['GIS:', 'gis:', ''];

        propertyNames.forEach(propName => {
            for (let prefix of prefixes) {
                const elem = featureNode.querySelector(prefix + propName);
                if (elem && elem.textContent) {
                    properties[propName] = elem.textContent.trim();
                    break;
                }
            }
        });

        // Also try to get all children elements
        const allElements = Array.from(featureNode.children);
        allElements.forEach(elem => {
            const tagName = elem.tagName;
            // Skip geometry elements
            if (!tagName.toLowerCase().includes('geom') &&
                !tagName.toLowerCase().includes('shape') &&
                !tagName.toLowerCase().includes('envelope') &&
                !tagName.toLowerCase().includes('bounded')) {
                const localName = tagName.split(':').pop();
                if (!properties[localName]) {
                    properties[localName] = elem.textContent.trim();
                }
            }
        });

        return properties;
    },

    /**
     * Extract geometry from feature node
     */
    extractGeometry: function(featureNode) {
        // First look for GIS:Geometry element (as seen in Espoo data)
        let geometryContainer = featureNode.querySelector('GIS\\:Geometry, Geometry');
        if (!geometryContainer) {
            // Try with different namespace
            const allElems = Array.from(featureNode.children);
            geometryContainer = allElems.find(elem =>
                elem.tagName.includes('Geometry') ||
                elem.tagName.includes('GEOMETRY') ||
                elem.tagName.includes('geom') ||
                elem.tagName.includes('Shape')
            );
        }

        // Now look for actual geometry type within the container (or the feature itself)
        const searchNode = geometryContainer || featureNode;

        const geomSelectors = [
            'gml\\:Point', 'Point',
            'gml\\:Polygon', 'Polygon',
            'gml\\:MultiPolygon', 'MultiPolygon',
            'gml\\:LineString', 'LineString',
            'gml\\:MultiLineString', 'MultiLineString'
        ];

        let geomNode = null;
        for (let selector of geomSelectors) {
            geomNode = searchNode.querySelector(selector);
            if (geomNode) break;
        }

        if (!geomNode) return null;

        const geomType = geomNode.tagName.split(':').pop();

        switch (geomType) {
            case 'Point':
                return this.parsePoint(geomNode);
            case 'Polygon':
                return this.parsePolygon(geomNode);
            case 'MultiPolygon':
                return this.parseMultiPolygon(geomNode);
            case 'LineString':
                return this.parseLineString(geomNode);
            default:
                console.warn('Unknown geometry type:', geomType);
                return null;
        }
    },

    /**
     * Parse Point geometry
     */
    parsePoint: function(pointNode) {
        const pos = pointNode.querySelector('pos, gml\\:pos, coordinates, gml\\:coordinates');
        if (!pos) return null;

        const coords = this.parseCoordinates(pos.textContent);
        if (!coords || coords.length === 0) return null;

        return {
            type: 'Point',
            coordinates: coords[0]
        };
    },

    /**
     * Parse Polygon geometry
     */
    parsePolygon: function(polygonNode) {
        const rings = [];

        // Get exterior ring
        const exterior = polygonNode.querySelector('exterior, gml\\:exterior, outerBoundaryIs');
        if (exterior) {
            const ring = this.parseLinearRing(exterior);
            if (ring) rings.push(ring);
        }

        // Get interior rings (holes)
        const interiors = polygonNode.querySelectorAll('interior, gml\\:interior, innerBoundaryIs');
        interiors.forEach(interior => {
            const ring = this.parseLinearRing(interior);
            if (ring) rings.push(ring);
        });

        if (rings.length === 0) {
            // Try direct LinearRing
            const ring = this.parseLinearRing(polygonNode);
            if (ring) rings.push(ring);
        }

        return rings.length > 0 ? {
            type: 'Polygon',
            coordinates: rings
        } : null;
    },

    /**
     * Parse MultiPolygon geometry
     */
    parseMultiPolygon: function(multiPolygonNode) {
        const polygons = [];

        const polygonMembers = multiPolygonNode.querySelectorAll('polygonMember, gml\\:polygonMember');
        polygonMembers.forEach(member => {
            const polygon = member.querySelector('Polygon, gml\\:Polygon');
            if (polygon) {
                const parsed = this.parsePolygon(polygon);
                if (parsed) {
                    polygons.push(parsed.coordinates);
                }
            }
        });

        return polygons.length > 0 ? {
            type: 'MultiPolygon',
            coordinates: polygons
        } : null;
    },

    /**
     * Parse LinearRing
     */
    parseLinearRing: function(ringContainer) {
        const linearRing = ringContainer.querySelector('LinearRing, gml\\:LinearRing');
        if (!linearRing) return null;

        let coords = [];

        // First try posList (single element with all coordinates)
        const posListNode = linearRing.querySelector('posList, gml\\:posList');
        if (posListNode) {
            coords = this.parsePosList(posListNode.textContent);
        }

        // Then try individual pos elements (as in Espoo data)
        if (coords.length === 0) {
            const posNodes = linearRing.querySelectorAll('pos, gml\\:pos');
            if (posNodes.length > 0) {
                posNodes.forEach(pos => {
                    const values = pos.textContent.trim().split(/\s+/).map(Number);
                    if (values.length >= 2) {
                        coords.push([values[0], values[1]]);
                    }
                });
            }
        }

        // Finally try coordinates element
        if (coords.length === 0) {
            const coordinatesNode = linearRing.querySelector('coordinates, gml\\:coordinates');
            if (coordinatesNode) {
                coords = this.parseCoordinates(coordinatesNode.textContent);
            }
        }

        return coords.length > 0 ? coords : null;
    },

    /**
     * Parse LineString geometry
     */
    parseLineString: function(lineStringNode) {
        const posListNode = lineStringNode.querySelector('posList, gml\\:posList');
        const coordinatesNode = lineStringNode.querySelector('coordinates, gml\\:coordinates');

        let coords = null;

        if (posListNode) {
            coords = this.parsePosList(posListNode.textContent);
        } else if (coordinatesNode) {
            coords = this.parseCoordinates(coordinatesNode.textContent);
        }

        return coords ? {
            type: 'LineString',
            coordinates: coords
        } : null;
    },

    /**
     * Parse posList (space-separated coordinates)
     */
    parsePosList: function(posListText) {
        const values = posListText.trim().split(/\s+/).map(Number);
        const coords = [];

        // Assume 2D coordinates (x, y pairs)
        for (let i = 0; i < values.length; i += 2) {
            if (i + 1 < values.length) {
                coords.push([values[i], values[i + 1]]);
            }
        }

        return coords;
    },

    /**
     * Parse coordinates string
     */
    parseCoordinates: function(coordsText) {
        const coords = [];

        // Handle different coordinate formats
        if (coordsText.includes(',')) {
            // Format: "x,y x,y" or "x,y,z x,y,z"
            const pairs = coordsText.trim().split(/\s+/);
            pairs.forEach(pair => {
                const values = pair.split(',').map(Number);
                if (values.length >= 2) {
                    coords.push([values[0], values[1]]);
                }
            });
        } else {
            // Format: "x y" (single coordinate pair)
            const values = coordsText.trim().split(/\s+/).map(Number);
            if (values.length >= 2) {
                coords.push([values[0], values[1]]);
            }
        }

        return coords;
    }
};
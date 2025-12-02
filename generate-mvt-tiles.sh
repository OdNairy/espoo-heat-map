#!/bin/bash

# Generate MVT (Mapbox Vector Tiles) from Espoo Buildings GeoJSON
# This script creates a directory structure of .pbf tiles in data/tiles/{z}/{x}/{y}.pbf format
# Industry-standard approach used by Google Maps, Mapbox, OpenStreetMap, etc.

set -e  # Exit on error

# Configuration
INPUT_FILE="data/espoo-buildings.json"
OUTPUT_DIR="data/tiles"
MIN_ZOOM=9
MAX_ZOOM=14
LAYER_NAME="buildings"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Espoo Buildings MVT Tile Generator ===${NC}\n"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ Error: Input file not found: $INPUT_FILE${NC}"
    echo -e "${YELLOW}Please run 'node update-buildings.js' first to generate the GeoJSON data.${NC}"
    exit 1
fi

# Check if tippecanoe is installed
if ! command -v tippecanoe &> /dev/null; then
    echo -e "${RED}❌ Error: tippecanoe is not installed${NC}"
    echo -e "${YELLOW}Install with: brew install tippecanoe${NC}"
    exit 1
fi

# Get input file size
INPUT_SIZE=$(du -h "$INPUT_FILE" | cut -f1)
echo -e "${BLUE}📄 Input file: $INPUT_FILE (${INPUT_SIZE})${NC}"

# Count features in input file
FEATURE_COUNT=$(grep -o '"type": "Feature"' "$INPUT_FILE" | wc -l | xargs)
echo -e "${BLUE}📊 Features in input: ${FEATURE_COUNT}${NC}\n"

# Remove existing tiles directory if it exists
if [ -d "$OUTPUT_DIR" ]; then
    echo -e "${YELLOW}🗑️  Removing existing tiles directory...${NC}"
    rm -rf "$OUTPUT_DIR"
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}🚀 Generating MVT tiles...${NC}"
echo -e "${BLUE}   Zoom levels: ${MIN_ZOOM}-${MAX_ZOOM}${NC}"
echo -e "${BLUE}   Layer name: ${LAYER_NAME}${NC}"
echo -e "${BLUE}   Output: ${OUTPUT_DIR}/{z}/{x}/{y}.pbf${NC}\n"

# Run tippecanoe
# Options explained:
# --output-to-directory: Create directory structure instead of MBTiles file
# --force: Overwrite existing output
# --drop-densest-as-needed: Smart feature dropping to keep tiles under 500KB
# --extend-zooms-if-still-dropping: Continue to higher zoom if needed
# --minimum-zoom: Don't generate tiles below this zoom
# --maximum-zoom: Stop generating at this zoom
# --base-zoom: Full detail at this zoom, simplified below
# --layer: Layer name for MapLibre source-layer property
# --name, --attribution, --description: Metadata
# --no-feature-limit: Don't limit features per tile
# --no-tile-size-limit: Don't enforce size limit (rely on dropping)
# --detect-shared-borders: Reduces duplicate vertices
# --buffer: Pixels of buffer around tiles (prevents label clipping)

tippecanoe \
    --output-to-directory="$OUTPUT_DIR" \
    --force \
    --drop-densest-as-needed \
    --extend-zooms-if-still-dropping \
    --minimum-zoom=$MIN_ZOOM \
    --maximum-zoom=$MAX_ZOOM \
    --base-zoom=$MAX_ZOOM \
    --layer="$LAYER_NAME" \
    --name="Espoo Buildings" \
    --attribution="Espoo City - Open Data" \
    --description="63,206 building points in Espoo, Finland" \
    --no-feature-limit \
    --no-tile-size-limit \
    --detect-shared-borders \
    --buffer=5 \
    --no-tile-compression \
    "$INPUT_FILE"

# Check if generation was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Tiles generated successfully!${NC}\n"

    # Count generated tiles
    TILE_COUNT=$(find "$OUTPUT_DIR" -name "*.pbf" | wc -l | xargs)
    echo -e "${BLUE}📊 Statistics:${NC}"
    echo -e "   Total tiles generated: ${GREEN}${TILE_COUNT}${NC}"

    # Calculate total size
    TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
    echo -e "   Total size: ${GREEN}${TOTAL_SIZE}${NC}"

    # Show tiles per zoom level
    echo -e "\n${BLUE}   Tiles per zoom level:${NC}"
    for z in $(seq $MIN_ZOOM $MAX_ZOOM); do
        if [ -d "$OUTPUT_DIR/$z" ]; then
            COUNT=$(find "$OUTPUT_DIR/$z" -name "*.pbf" | wc -l | xargs)
            echo -e "   - Zoom $z: ${YELLOW}${COUNT}${NC} tiles"
        fi
    done

    # Show metadata file
    if [ -f "$OUTPUT_DIR/metadata.json" ]; then
        echo -e "\n${BLUE}📋 Metadata file created: ${OUTPUT_DIR}/metadata.json${NC}"
    fi

    echo -e "\n${GREEN}✨ Done! MVT tiles are ready to deploy.${NC}"
    echo -e "${BLUE}💡 Next steps:${NC}"
    echo -e "   1. Update vercel.json with .pbf headers"
    echo -e "   2. Update js/config.js with MVT configuration"
    echo -e "   3. Update js/map.js to use vector source"
    echo -e "   4. Deploy to Vercel"
else
    echo -e "\n${RED}❌ Error: Tile generation failed${NC}"
    exit 1
fi

#!/usr/bin/env python3
"""
Simple HTTP server with proper headers for MVT tiles
"""

import http.server
import socketserver
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

        # Add specific headers for PBF files
        # NOTE: Tippecanoe gzips the .pbf files, but we DON'T set Content-Encoding: gzip
        # because MapLibre expects to receive the raw gzipped protobuf bytes
        if self.path.endswith('.pbf'):
            self.send_header('Content-Type', 'application/x-protobuf')
            self.send_header('Cache-Control', 'public, max-age=31536000')

        # Add headers for JSON files
        elif self.path.endswith('.json'):
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'public, max-age=3600')

        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Serving directory: {os.getcwd()}")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

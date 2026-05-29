"""ColorForge static server — serves ES modules with correct MIME types."""
import http.server
import socketserver
import os

PORT = int(os.environ.get('PORT', 3000))
HOST = '0.0.0.0'

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
    }
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

print(f"ColorForge serving on {HOST}:{PORT}")
with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
    httpd.serve_forever()

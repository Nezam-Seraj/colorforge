"""ColorForge — static server + secure Gemini API proxy.

Serves static files with correct MIME types.
Proxies /api/generate to Gemini 2.0 Flash for image generation.
API key is read from GEMINI_API_KEY env var — NEVER exposed to client.
"""
import http.server
import socketserver
import os
import json
import urllib.request
import urllib.error
import ssl

PORT = int(os.environ.get('PORT', 3000))
HOST = '0.0.0.0'
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API') or ''
GEMINI_MODEL = 'gemini-2.0-flash'
GEMINI_URL = f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent'

STYLE_PROMPTS = {
    'mandala': 'symmetrical mandala pattern, geometric precision, sacred geometry',
    'botanical': 'detailed botanical illustration, leaves and flowers, natural forms',
    'geometric': 'geometric abstract pattern, clean lines, mathematical precision',
    'fantasy': 'fantasy illustration, mythical creatures, magical atmosphere',
    'zen': 'zen meditation art, flowing lines, peaceful minimal design',
    'animals': 'animal portrait, detailed fur and features, natural pose',
    'architecture': 'architectural drawing, buildings and structures, detailed',
    'abstract': 'abstract art pattern, flowing curves and shapes, artistic',
    'food': 'food illustration, appetizing details, culinary art',
    'space': 'space scene, planets and stars, cosmic wonder',
}

COMPLEXITY_MAP = {
    'simple': 'simple outlines, large open spaces, minimal details',
    'medium': 'moderate detail, balanced composition, clear sections',
    'intricate': 'highly detailed, intricate patterns, many small sections, fine lines',
}

SYSTEM_INSTRUCTION = (
    'You are a coloring book artist. Generate ONLY black and white line art suitable for coloring. Rules:\n'
    '- Pure black lines on pure white background\n'
    '- NO color, NO shading, NO grayscale, NO fills\n'
    '- Thick, bold outlines around major shapes\n'
    '- Thinner lines for internal details\n'
    '- Clean, crisp vector-art style\n'
    '- All shapes must be fully enclosed (closed paths) so they can be bucket-filled\n'
    '- Output as a single image with no text overlay'
)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
    }

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

    def do_POST(self):
        if self.path == '/api/generate':
            self.handle_generate()
        else:
            self.send_error(404)

    def handle_generate(self):
        if not GEMINI_API_KEY:
            self.send_json(503, {'error': 'Gemini API key not configured'})
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            prompt = body.get('prompt', '')
            style = body.get('style', 'mandala')
            complexity = body.get('complexity', 'medium')
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {'error': 'Invalid JSON body'})
            return

        if not prompt:
            self.send_json(400, {'error': 'Prompt is required'})
            return

        full_prompt = '. '.join(filter(None, [
            'coloring book page',
            'black and white line art only',
            'thick bold outlines, no shading, no color',
            'clean white background',
            STYLE_PROMPTS.get(style, style) or style,
            COMPLEXITY_MAP.get(complexity, 'moderate detail'),
            prompt,
        ]))

        payload = json.dumps({
            'contents': [{'parts': [{'text': full_prompt}]}],
            'systemInstruction': {'parts': [{'text': SYSTEM_INSTRUCTION}]},
            'generationConfig': {
                'responseModalities': ['TEXT', 'IMAGE'],
                'temperature': 0.4,
            }
        }).encode('utf-8')

        url = f'{GEMINI_URL}?key={GEMINI_API_KEY}'
        req = urllib.request.Request(
            url,
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )

        try:
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            print(f'Gemini API error {e.code}: {err_body[:500]}')
            try:
                err_json = json.loads(err_body)
                error_msg = err_json.get('error', {}).get('message', '')
            except Exception:
                error_msg = ''
            
            display_msg = f"Gemini API error {e.code}"
            if error_msg:
                display_msg += f": {error_msg}"
            else:
                display_msg += f" — {err_body[:100]}"
                
            self.send_json(502, {'error': display_msg})
            return
        except Exception as e:
            print(f'Gemini request failed: {e}')
            self.send_json(502, {'error': f'Request failed: {str(e)}'})
            return

        # Extract image from response
        for part in data.get('candidates', [{}])[0].get('content', {}).get('parts', []):
            inline = part.get('inlineData', {})
            if inline.get('data'):
                mime = inline.get('mimeType', 'image/png')
                self.send_json(200, {
                    'image': f'data:{mime};base64,{inline["data"]}'
                })
                return

        self.send_json(502, {'error': 'No image in Gemini response'})

    def send_json(self, status, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    if GEMINI_API_KEY:
        print(f'Gemini API: configured ✓')
    else:
        print('Gemini API: NOT configured (set GEMINI_API_KEY env var)')
    print(f'ColorForge serving on {HOST}:{PORT}')
    with socketserver.ThreadingTCPServer((HOST, PORT), Handler) as httpd:
        httpd.serve_forever()

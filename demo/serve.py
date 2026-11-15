# runs the demo at http://localhost:8123
# the two extra headers let the browser use several processor cores for whisper, which makes each try faster
import http.server
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        super().end_headers()


print("relay demo running at http://localhost:8123")
http.server.ThreadingHTTPServer(("localhost", 8123), Handler).serve_forever()

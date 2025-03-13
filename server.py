import http.server
import socketserver
import os

# Puerto que usará el servidor
PORT = int(os.environ.get('PORT', 8000))

# Configurar el manejador para servir archivos estáticos
Handler = http.server.SimpleHTTPRequestHandler

# Permitir reutilizar el puerto
socketserver.TCPServer.allow_reuse_address = True

# Crear el servidor
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"\n=== Servidor iniciado en el puerto {PORT} ===")
    print(f"* Accede a través de: http://localhost:{PORT}")
    print("\nPresiona Ctrl+C para detener el servidor\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.") 
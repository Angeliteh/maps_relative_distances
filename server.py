import http.server
import socketserver
import socket

def get_local_ip():
    try:
        # Crear un socket temporal para obtener la IP local
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

# Puerto en el que se ejecutará el servidor
PORT = 8000

# Configurar el manejador para servir archivos estáticos
Handler = http.server.SimpleHTTPRequestHandler

# Permitir reutilizar el puerto
socketserver.TCPServer.allow_reuse_address = True

# Crear el servidor
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    local_ip = get_local_ip()
    print(f"\n=== Servidor iniciado ===")
    print(f"* Accede desde tu computadora: http://localhost:{PORT}")
    print(f"* Accede desde otros dispositivos en la red: http://{local_ip}:{PORT}")
    print("\nPresiona Ctrl+C para detener el servidor\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.") 
import socket
import sys

# プロトコル選択: "tcp" または "udp"
protocol = sys.argv[1] if len(sys.argv) > 1 else "tcp"
port = 2222


if protocol.lower() == "tcp":
    s = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    s.bind(("::", port))
    s.listen()
    print(f"Listening on IPv6 TCP port {port}...")

    while True:
        conn, addr = s.accept()
        print(f"TCP connection from {addr}")
        conn.sendall(b"Hello from IPv6 TCP server!\n")
        conn.close()

elif protocol.lower() == "udp":
    s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
    s.bind(("::", port))
    print(f"Listening on IPv6 UDP port {port}...")

    while True:
        data, addr = s.recvfrom(1024)
        print(f"UDP packet from {addr}: {data}")
        s.sendto(b"Hello from IPv6 UDP server!\n", addr)

else:
    print("Invalid protocol. Use 'tcp' or 'udp'.")

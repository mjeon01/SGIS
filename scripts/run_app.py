"""Run both local services and stop only the child processes started here."""
import argparse
import errno
import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def available(port):
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('127.0.0.1', port))
        except OSError as exc:
            if exc.errno != errno.EADDRINUSE:
                raise
            raise SystemExit(f'Port {port} is in use. Choose different --port / --api-port values.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['sgis', 'sample'], default=None)
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--api-port', type=int, default=8000)
    parser.add_argument('--production', action='store_true')
    args = parser.parse_args()
    available(args.port)
    available(args.api_port)
    env = {**os.environ, 'BACKEND_URL': f'http://127.0.0.1:{args.api_port}'}
    if args.mode:
        env['DATA_MODE'] = args.mode
    if args.production:
        manifest = ROOT / 'frontend' / '.next' / 'routes-manifest.json'
        if not manifest.exists():
            raise SystemExit('Run npm --prefix frontend run build before --production.')
        rewrites = json.loads(manifest.read_text()).get('rewrites', {})
        rules = rewrites if isinstance(rewrites, list) else [rule for group in rewrites.values() for rule in group]
        expected = env['BACKEND_URL'] + '/api/:path*'
        if not any(rule.get('destination') == expected for rule in rules):
            raise SystemExit(f'Build frontend with BACKEND_URL={env["BACKEND_URL"]} before using this API port in production.')
    children = []
    def stop(_signal=None, _frame=None):
        for child in children:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
        if _signal is not None:
            raise SystemExit(0)
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    try:
        children.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', str(args.api_port)], cwd=ROOT, env=env, start_new_session=True))
        children.append(subprocess.Popen(['npm', 'run', 'start' if args.production else 'dev', '--', '--port', str(args.port)], cwd=ROOT / 'frontend', env=env, start_new_session=True))
        print(f'ClimateGuard: http://127.0.0.1:{args.port} | API docs: http://127.0.0.1:{args.api_port}/docs', flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(.5)
    finally:
        stop()


if __name__ == '__main__':
    main()

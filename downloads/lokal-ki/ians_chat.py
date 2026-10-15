#!/usr/bin/env python3
"""IANS local chat v1.0, 2026-10-15. Python 3.10+, standard library only.
No tools, shell execution of model output, file access or persistent chat log.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from urllib import request, error

MODELS = ('gemma3:1b', 'gemma3:4b')
BASE = 'http://127.0.0.1:11434'
# Ignore proxy environment variables. Never follow a redirect to another server.
class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
CLIENT = request.build_opener(request.ProxyHandler({}), NoRedirect())

def api(path, payload=None):
    data = None if payload is None else json.dumps(payload).encode('utf-8')
    req = request.Request(BASE + path, data=data, headers={'Content-Type': 'application/json'})
    with CLIENT.open(req, timeout=600) as response:
        return json.load(response)

def configure():
    path = Path.home() / '.ollama' / 'server.json'
    cfg = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    if not isinstance(cfg, dict):
        raise ValueError('Ollama server.json must contain a JSON object; file left unchanged.')
    if cfg.get('disable_ollama_cloud') is True:
        print('Cloud features are already disabled in server.json.')
        return
    if input('Disable Ollama cloud features in ~/.ollama/server.json? [y/N] ').strip().lower() != 'y':
        print('No settings changed. See README for local-only configuration.')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        backup = path.with_name('server.json.ians-backup')
        if backup.exists():
            raise ValueError('Backup already exists; inspect it before configuring again.')
        shutil.copy2(path, backup)
    cfg['disable_ollama_cloud'] = True
    path.write_text(json.dumps(cfg, indent=2) + '\n', encoding='utf-8')
    print('Saved. Fully quit and restart Ollama BEFORE setup or chat. See README.')

def setup(model):
    binary = shutil.which('ollama')
    if not binary:
        print('Install Ollama first: https://ollama.com/download then reopen this terminal.')
        return 1
    api('/api/tags')  # Verify the local service before starting a download.
    print('Model:', model, '(about 0.8 GB for 1b or 3.4 GB for 4b; download sizes may change).')
    if input('Download model from the Ollama registry? [y/N] ').strip().lower() != 'y':
        print('Download cancelled.')
        return 0
    return subprocess.run([binary, 'pull', model], check=False).returncode

def chat(model):
    available = {m.get('name') for m in api('/api/tags').get('models', [])}
    if model not in available:
        print('Model is not installed. Run with --setup --model', model)
        return 1
    history = [{'role': 'system', 'content': 'Svar pa norsk med mindre brukeren ber om et annet sprak. Vaer tydelig om usikkerhet. Du er en lokal tekstassistent uten nettleser, filer eller verktoy.'}]
    print('IANS local chat |', model, '| /clear resets chat; /quit exits.')
    print('No chat is saved by this program. First response may take several minutes.')
    while True:
        try:
            prompt = input('\nDu: ').strip()
        except EOFError:
            break
        if prompt == '/quit':
            break
        if prompt == '/clear':
            history = history[:1]
            print('Chat cleared.')
            continue
        if not prompt:
            continue
        if len(prompt) > 8000:
            print('Use less than 8,000 characters per message.')
            continue
        # Keep the context bounded; no claim of unlimited memory.
        recent = history[1:][-6:]
        candidate = history[:1] + recent + [{'role': 'user', 'content': prompt}]
        response = api('/api/chat', {'model': model, 'messages': candidate, 'stream': False,
                                    'options': {'num_ctx': 4096, 'num_predict': 512}})
        answer = response.get('message', {}).get('content', '')
        if not answer:
            print('No text returned; try /clear or a smaller model.')
            continue
        # Strip control characters including terminal escape sequences.
        safe = ''.join(c for c in answer if c in '\n\t' or (c.isprintable() and c != '\x7f'))
        print('\nKI:', safe)
        history = candidate + [{'role': 'assistant', 'content': answer}]
    return 0

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', choices=MODELS, default=MODELS[0])
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--setup', action='store_true')
    group.add_argument('--configure-local', action='store_true')
    args = parser.parse_args()
    try:
        if args.configure_local:
            configure()
            return 0
        return setup(args.model) if args.setup else chat(args.model)
    except (error.URLError, TimeoutError, ConnectionError) as exc:
        print('Could not reach local Ollama or the request timed out. Start Ollama and retry.', exc, file=sys.stderr)
        return 1
    except (OSError, ValueError) as exc:
        print('Error:', exc, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('\nStopped. No chat saved.')
        return 0

if __name__ == '__main__':
    sys.exit(main())

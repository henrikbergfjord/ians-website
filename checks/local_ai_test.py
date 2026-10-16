"""Run: python3 checks/local_ai_test.py. Never downloads a model."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
import hashlib
from unittest.mock import patch
from urllib import error

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ians_chat', ROOT/'downloads/lokal-ki/ians_chat.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class LocalChatTests(unittest.TestCase):
    def test_chat_posts_only_local_model_and_discards_history(self):
        calls=[]
        def fake(path,payload=None):
            calls.append((path,payload))
            return {'models':[{'name':'gemma3:1b'}]} if path=='/api/tags' else {'message':{'content':'Svar\x1b[31m'}}
        with patch.object(app,'api',side_effect=fake),patch('builtins.input',side_effect=['Hei','/clear','Nytt','/quit']),patch('sys.stdout',new_callable=io.StringIO) as out:
            self.assertEqual(app.chat('gemma3:1b'),0)
            self.assertNotIn('\x1b',out.getvalue())
        self.assertEqual(len(calls[2][1]['messages']),2)
        self.assertFalse(calls[1][1]['stream'])
        self.assertEqual(calls[1][1]['model'],'gemma3:1b')
    def test_missing_model_does_not_generate(self):
        with patch.object(app,'api',return_value={'models':[]}) as mock,patch('sys.stdout',new_callable=io.StringIO):
            self.assertEqual(app.chat('gemma3:4b'),1)
            self.assertEqual(mock.call_count,1)
    def test_download_requires_confirmation(self):
        with patch.object(app.shutil,'which',return_value='/fake/ollama'),patch.object(app,'api',return_value={}),patch('builtins.input',return_value='n'),patch.object(app.subprocess,'run') as run,patch('sys.stdout',new_callable=io.StringIO):
            self.assertEqual(app.setup('gemma3:1b'),0)
            run.assert_not_called()
    def test_confirmed_download_uses_argument_list(self):
        with patch.object(app.shutil,'which',return_value='/fake/ollama'),patch.object(app,'api',return_value={}),patch('builtins.input',return_value='y'),patch.object(app.subprocess,'run') as run,patch('sys.stdout',new_callable=io.StringIO):
            run.return_value.returncode=0
            self.assertEqual(app.setup('gemma3:1b'),0)
            run.assert_called_once_with(['/fake/ollama','pull','gemma3:1b'],check=False)
    def test_local_configuration_preserves_user_settings(self):
        with tempfile.TemporaryDirectory() as tmp,patch.object(app.Path,'home',return_value=Path(tmp)),patch('builtins.input',return_value='y'),patch('sys.stdout',new_callable=io.StringIO):
            path=Path(tmp)/'.ollama/server.json';path.parent.mkdir();path.write_text('{"other": 7}')
            app.configure()
            self.assertEqual(json.loads(path.read_text()),{'other':7,'disable_ollama_cloud':True})
            self.assertEqual(json.loads(path.with_name('server.json.ians-backup').read_text()),{'other':7})
    def test_api_fixed_loopback(self):
        class Response:
            def __enter__(self):return io.StringIO('{"message":{"content":"ok"}}')
            def __exit__(self,*args):pass
        with patch.object(app.CLIENT,'open',return_value=Response()) as mocked:
            app.api('/api/chat',{'model':'gemma3:1b'})
            self.assertEqual(mocked.call_args.args[0].full_url,'http://127.0.0.1:11434/api/chat')
    def test_redirects_are_not_followed(self):
        self.assertIsNone(app.NoRedirect().redirect_request(None,None,302,'redirect',{},'https://example.com'))
    def test_cloud_model_is_rejected(self):
        with patch('sys.argv',['ians_chat.py','--model','gemma4:cloud']),patch('sys.stderr',new_callable=io.StringIO):
            with self.assertRaises(SystemExit) as exc: app.main()
            self.assertEqual(exc.exception.code,2)
    def test_connection_failure_is_explained(self):
        with patch('sys.argv',['ians_chat.py']),patch.object(app,'api',side_effect=error.URLError('offline')),patch('sys.stderr',new_callable=io.StringIO):
            self.assertEqual(app.main(),1)
    def test_download_archive_matches_current_client_and_hash(self):
        path=ROOT/'downloads/ians-lokal-ki-v1.1.zip'
        expected=(ROOT/'downloads/ians-lokal-ki-v1.1.sha256').read_text().split()[0]
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),expected)
        with zipfile.ZipFile(path) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.read('ians-lokal-ki/ians_chat.py'),(ROOT/'downloads/lokal-ki/ians_chat.py').read_bytes())
            self.assertFalse(any('__pycache__' in n for n in archive.namelist()))
    def test_only_named_local_models_are_offered(self):
        self.assertIn('llama3.2:latest',app.MODELS)
        self.assertTrue(all('cloud' not in m and '://' not in m for m in app.MODELS))
    def test_interrupt_exits_cleanly(self):
        with patch('sys.argv',['ians_chat.py']),patch.object(app,'api',side_effect=KeyboardInterrupt),patch('sys.stdout',new_callable=io.StringIO):
            self.assertEqual(app.main(),0)
if __name__=='__main__':unittest.main()

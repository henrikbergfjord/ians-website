from pathlib import Path
import json,re,subprocess
root=Path(__file__).resolve().parents[1];m=json.loads((root/'publication.json').read_text());cfg=json.loads((root/'staticwebapp.config.json').read_text())
assert not any(x.startswith(('tools/','academy/','games/','.')) for x in m['staticFiles'])
assert set(x.split('/')[1] for x in m['apiFiles'] if x.endswith('/function.json'))=={'azure-cost','axion-advisor','axion-proposal-send','contact'}
def match(p):return next(r for r in cfg['routes'] if (p.startswith(r['route'][:-1]) if r['route'].endswith('*') else p==r['route']))
for p in ['/admin','/admin/','/admin/index.html','/admin/costs','/admin/costs.html','/api/azure-cost']:
 assert match(p)['allowedRoles']==['authenticated'],p
for p in ['/axion-grid/admin','/axion-grid/admin/','/axion-grid/admin/access.html','/axion-grid/admin/access','/axion-grid/customer/index.html','/api/axion-advisor','/api/axion-proposal-send']:
 roles=match(p)['allowedRoles'];assert 'authenticated' not in roles and 'anonymous' not in roles,p
for p in ['/SameieNettold.html','/tools/money-planner/v01.html','/booking-admin.html','/.money-planner-backup/old/index.html','/api/booking','/api/dinner-planner-ai']:
 assert match(p)['statusCode']==404,p
for f in m['staticFiles']:
 if f.endswith('.html'):
  from html.parser import HTMLParser
  class H(HTMLParser):
   def handle_starttag(self,tag,attrs):
    a=dict(attrs)
    if tag=='script' and not a.get('src'):self.code=''
   def handle_data(self,t):
    if hasattr(self,'code'):self.code+=t
   def handle_endtag(self,tag):
    if tag=='script' and hasattr(self,'code'):
     result=subprocess.run(['node','--check'],input=self.code,text=True,capture_output=True);assert result.returncode==0,(f,result.stderr);del self.code
  H().feed((root/f).read_text())
print('PASS Axion allowlist, retired routes, role boundaries and inline script syntax')

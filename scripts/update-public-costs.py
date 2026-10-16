#!/usr/bin/env python3
"""Refresh the public aggregate from the signed-in Azure CLI account; never writes resource IDs.
Run manually: python3 scripts/update-public-costs.py --output assets/ians-home/costs.json
This command does not publish, create credentials or schedule a job.
"""
import argparse,datetime,json,subprocess
from pathlib import Path

def query(args):return json.loads(subprocess.check_output(['az',*args,'--only-show-errors','-o','json'],text=True))
def build():
 now=datetime.datetime.now(datetime.timezone.utc);start=now.replace(day=1,hour=0,minute=0,second=0,microsecond=0);end=now.replace(hour=0,minute=0,second=0,microsecond=0)-datetime.timedelta(seconds=1)
 if end<start:raise ValueError('No completed day in this month yet; keep the previous dated reading.')
 subscription=query(['account','show'])['id']
 body={'type':'ActualCost','timeframe':'Custom','timePeriod':{'from':start.isoformat(),'to':end.isoformat()},'dataset':{'granularity':'None','aggregation':{'totalCost':{'name':'Cost','function':'Sum'}},'grouping':[{'type':'Dimension','name':'ResourceId'}]}}
 p=query(['rest','--method','post','--url',f'https://management.azure.com/subscriptions/{subscription}/providers/Microsoft.CostManagement/query?api-version=2023-03-01','--body',json.dumps(body)])['properties']
 if p.get('nextLink'):raise ValueError('Paged cost response must be reviewed; no incomplete aggregate written.')
 columns=[x['name'] for x in p['columns']];rows=[dict(zip(columns,x)) for x in p['rows']]
 if {x.get('Currency') for x in rows}!={'NOK'}:raise ValueError('No verified NOK result; no values written.')
 key=next(c for c in columns if c.lower() in ['cost','pretaxcost','costinbillingcurrency'])
 total=sum(float(x[key]) for x in rows)
 if total<0:raise ValueError('Credit balance needs separate presentation; previous reading retained.')
 def value(name):return sum(float(x[key]) for x in rows if str(x.get('ResourceId','')).lower().endswith('/staticsites/'+name))
 return{'status':'available','currency':'NOK','periodStart':start.date().isoformat(),'periodEnd':end.date().isoformat(),'updatedAt':now.isoformat(),'staticWebApps':{'iansNok':round(value('bergfjord-home'),2),'sogodNok':round(value('sogod-home'),2)},'azureTotalNok':round(total,2),'includes':['Azure-forbruk i det valgte abonnementet, også tjenester utover IANS og SOGOD','IANS og SOGOD Static Web Apps som egne delsummer'],'excludes':['Domener','OpenAI og andre eksterne KI-tjenester','Kostnader utenfor det valgte Azure-abonnementet'],'includesEn':['Azure usage in the selected subscription, including services beyond IANS and SOGOD','IANS and SOGOD Static Web Apps as separate subtotals'],'excludesEn':['Domains','OpenAI and other external AI services','Costs outside the selected Azure subscription'],'noteEn':'Recorded Azure usage may be delayed. This is not a final invoice.','source':'Azure Cost Management Query API, ActualCost','note':'Registrert Azure-forbruk; siste døgn kan være forsinket. Ikke en sluttfaktura.'}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();data=build();args.output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print('Wrote dated public aggregate:',data['periodStart'],data['periodEnd'],'NOK',data['azureTotalNok'])
